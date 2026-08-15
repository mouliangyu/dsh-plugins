import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { createServer } from "node:net";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { JsonRpcLineTransport } from "@deepseek-ai/dsh-sdk-protocol";
import { SessionId } from "@deepseek-ai/dsh-session";
//#region lib/types/index.js
/** Persistent remote top-level projects over a private Unix-domain control socket. @module dsh-remote */
/** Serve persistent remote projects and their root sessions through a private Unix socket. */
var RemoteProjectHost = class extends Service {
	config;
	static Config = z.object({
		socketPath: z.string().required(),
		projects: z.array(z.object({
			id: z.string().required(),
			root: z.string().required()
		})).default([]),
		projectsFile: z.string(),
		provider: z.string().default("deepseek-official"),
		model: z.string().default("deepseek-v4-flash")
	});
	projects = /* @__PURE__ */ new Map();
	sessions = /* @__PURE__ */ new Map();
	connections = /* @__PURE__ */ new Set();
	projectWrites = Promise.resolve();
	constructor(ctx, config) {
		super(ctx, "remoteProjectHost");
		this.config = config;
		for (const entry of config.projects ?? []) this.addConfiguredProject(entry);
	}
	/** Start the private listener; the host, rather than any SSH connection, owns live session handles. */
	async [Service.init]() {
		await this.loadProjectRegistry();
		const socketPath = resolve(this.config.socketPath);
		try {
			if (!(await lstat(socketPath)).isSocket()) throw new Error(`remote project socket path already exists and is not a socket: ${socketPath}`);
			await unlink(socketPath);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const server = createServer((socket) => {
			this.attach(socket);
		});
		await new Promise((resolveListen, reject) => {
			server.once("error", reject);
			server.listen(socketPath, () => {
				server.off("error", reject);
				resolveListen();
			});
		});
		await chmod(socketPath, 384);
		this.ctx.effect(() => async () => {
			for (const connection of this.connections) connection.close();
			await this.projectWrites;
			await new Promise((resolveClose) => {
				server.close(() => {
					resolveClose();
				});
			});
			await unlink(socketPath).catch((error) => {
				if (error.code !== "ENOENT") throw error;
			});
		}, "remoteProjectHost.socket");
	}
	attach(socket) {
		const close = this.serve(socket, socket);
		socket.once("close", close);
	}
	/** Bind one private JSON-RPC stream; its disposer releases subscriptions without stopping the host. */
	serve(input, output) {
		const transport = new JsonRpcLineTransport(input, output);
		this.connections.add(transport);
		const subscriptions = /* @__PURE__ */ new Map();
		const close = () => {
			for (const dispose of subscriptions.values()) dispose();
			subscriptions.clear();
			this.connections.delete(transport);
			transport.close();
		};
		transport.onRequest(async (method, params) => {
			switch (method) {
				case "remote/hello": return {
					protocolVersion: 2,
					projects: [...this.projects.values()]
				};
				case "remote/projects/create": return { project: await this.createProject({
					id: stringParam(params, "projectId"),
					root: stringParam(params, "projectRoot")
				}) };
				case "remote/sessions/list": return { sessions: await this.list(this.project(params)) };
				case "remote/sessions/create": return { sessionId: await this.create(this.project(params)) };
				case "remote/sessions/resume":
					await this.resume(this.project(params), stringParam(params, "sessionId"));
					return {};
				case "remote/sessions/prompt": return { messageId: await this.prompt(this.project(params), stringParam(params, "sessionId"), contentBlocks(params)) };
				case "remote/sessions/cancel":
					this.record(this.project(params), stringParam(params, "sessionId")).handle.agent.cancel({ kind: "user" });
					return {};
				case "remote/events/subscribe": {
					const project = this.project(params);
					const sessionId = stringParam(params, "sessionId");
					const fromSeq = numberParam(params, "fromSeq");
					const key = `${project.id}:${sessionId}`;
					subscriptions.get(key)?.();
					await this.resume(project, sessionId);
					let replaying = true;
					const delivered = /* @__PURE__ */ new Set();
					const pending = [];
					const deliver = (event) => {
						if (event.seq < fromSeq || delivered.has(event.seq)) return;
						delivered.add(event.seq);
						transport.notify("remote/session.event", {
							projectId: project.id,
							sessionId,
							event
						});
					};
					const dispose = this.ctx.on("session/event", (session, event) => {
						if (String(session.id) !== sessionId) return;
						if (replaying) pending.push(event);
						else deliver(event);
					});
					subscriptions.set(key, dispose);
					const persisted = await this.persistence().readFrom(SessionId(sessionId), fromSeq);
					for (const event of persisted.events) deliver(event);
					replaying = false;
					for (const event of pending.sort((left, right) => left.seq - right.seq)) deliver(event);
					return {};
				}
				default: throw new Error(`unknown remote method: ${method}`);
			}
		});
		transport.start();
		return close;
	}
	project(params) {
		const project = this.projects.get(stringParam(params, "projectId"));
		if (project === void 0) throw new Error("unknown remote project");
		return project;
	}
	addConfiguredProject(entry) {
		const project = normalizeProject(entry);
		if (this.projects.has(project.id)) throw new Error(`duplicate remote project id: ${JSON.stringify(project.id)}`);
		this.projects.set(project.id, project);
	}
	async loadProjectRegistry() {
		const path = this.config.projectsFile;
		if (path === void 0) return;
		if (!isAbsolute(path)) throw new Error("remote projectsFile must be absolute");
		let raw;
		try {
			raw = await readFile(path, "utf8");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
			await this.persistProjects();
			return;
		}
		const stored = parseProjectRegistry(raw, path);
		this.projects.clear();
		for (const entry of stored.projects) this.addConfiguredProject(entry);
	}
	createProject(entry) {
		if (this.config.projectsFile === void 0) throw new Error("remote project creation requires projectsFile");
		const project = normalizeProject(entry);
		return this.queueProjectWrite(async () => {
			if (this.projects.has(project.id)) throw new Error(`remote project already exists: ${JSON.stringify(project.id)}`);
			await mkdir(project.root, { recursive: true });
			this.projects.set(project.id, project);
			try {
				await this.persistProjects();
			} catch (error) {
				this.projects.delete(project.id);
				throw error;
			}
			return project;
		});
	}
	queueProjectWrite(operation) {
		const result = this.projectWrites.then(operation, operation);
		this.projectWrites = result.then(() => {}, () => {});
		return result;
	}
	async persistProjects() {
		const path = this.config.projectsFile;
		if (path === void 0) return;
		await mkdir(dirname(path), {
			recursive: true,
			mode: 448
		});
		const temporary = `${path}.${randomUUID()}.tmp`;
		const document = {
			version: 0,
			projects: [...this.projects.values()]
		};
		try {
			await writeFile(temporary, JSON.stringify(document, void 0, 2) + "\n", {
				encoding: "utf8",
				flag: "wx",
				mode: 384
			});
			await rename(temporary, path);
		} finally {
			await unlink(temporary).catch((error) => {
				if (error.code !== "ENOENT") throw error;
			});
		}
	}
	async create(project) {
		const sessionId = `remote-${randomUUID()}`;
		const handle = await this.ctx.agents.create({
			sessionId: SessionId(sessionId),
			meta: { cwd: project.root },
			agentOptions: this.agentOptions()
		});
		this.sessions.set(sessionId, {
			handle,
			project
		});
		return sessionId;
	}
	async resume(project, sessionId) {
		const live = this.sessions.get(sessionId);
		if (live !== void 0) {
			if (live.project.id !== project.id) throw new Error("remote session belongs to another project");
			return live;
		}
		if ((await this.persistence().inspect(SessionId(sessionId))).meta.cwd !== project.root) throw new Error("remote session belongs to another project");
		const record = {
			handle: await this.ctx.agents.resume({
				resumeSessionId: SessionId(sessionId),
				agentOptions: this.agentOptions()
			}),
			project
		};
		this.sessions.set(sessionId, record);
		return record;
	}
	record(project, sessionId) {
		const record = this.sessions.get(sessionId);
		if (record === void 0 || record.project.id !== project.id) throw new Error("remote session is not attached");
		return record;
	}
	async prompt(project, sessionId, content) {
		const record = await this.resume(project, sessionId);
		const message = createUserMessage({
			content,
			source: { kind: "user" }
		});
		record.handle.agent.followup(message);
		return String(message.id);
	}
	async list(project) {
		const stored = await this.persistence().list();
		const live = [...this.sessions.values()].map((record) => record.handle.agent.session.header);
		return [...new Map([...stored, ...live].filter((header) => header.cwd === project.root).map((header) => [String(header.id), header])).values()];
	}
	persistence() {
		const persistence = this.ctx.get("sessionPersistence");
		if (persistence === void 0) throw new Error("remote host requires sessionPersistence");
		return persistence;
	}
	agentOptions() {
		return {
			...this.config.provider === void 0 ? {} : { provider: this.config.provider },
			...this.config.model === void 0 ? {} : { model: this.config.model }
		};
	}
};
function stringParam(params, key) {
	const value = params[key];
	if (typeof value !== "string" || value.length === 0) throw new TypeError(`remote ${key} must be a non-empty string`);
	return value;
}
function numberParam(params, key) {
	const value = params[key];
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`remote ${key} must be a non-negative safe integer`);
	return value;
}
function contentBlocks(params) {
	const value = params["contentBlocks"];
	if (!Array.isArray(value)) throw new TypeError("remote contentBlocks must be an array");
	return value;
}
/** Thin client for an SSH-bridged remote JSON-RPC stream. */
var RemoteProjectClient = class {
	transport;
	eventListeners = /* @__PURE__ */ new Set();
	/** @param input - bytes read from the SSH command's stdout. @param output - bytes written to its stdin. */
	constructor(input, output) {
		this.transport = new JsonRpcLineTransport(input, output);
		this.transport.onNotification((method, params) => {
			if (method !== "remote/session.event") return;
			const projectId = params["projectId"];
			const sessionId = params["sessionId"];
			const event = params["event"];
			if (typeof projectId === "string" && typeof sessionId === "string" && event !== null && typeof event === "object") {
				const notification = {
					projectId,
					sessionId,
					event
				};
				for (const listener of this.eventListeners) listener(notification);
			}
		});
		this.transport.start();
	}
	/**
	* Subscribe to realtime events on this transport.
	* @param listener - callback for durable session events.
	* @returns disposer removing this listener.
	*/
	onEvent(listener) {
		this.eventListeners.add(listener);
		return () => {
			this.eventListeners.delete(listener);
		};
	}
	/**
	* Request remote project inventory and protocol version.
	* @returns the handshake result.
	*/
	hello() {
		return this.transport.request("remote/hello", {});
	}
	/**
	* List persisted root sessions belonging to one remote project.
	* @param projectId - remote project id.
	* @returns the wire result.
	*/
	list(projectId) {
		return this.transport.request("remote/sessions/list", { projectId });
	}
	/**
	* Create one root session in a remote project.
	* @param projectId - remote project id.
	* @returns the new session result.
	*/
	create(projectId) {
		return this.transport.request("remote/sessions/create", { projectId });
	}
	/**
	* Create one persistent project on the remote host; duplicate ids reject.
	* @param projectId - stable remote project id.
	* @param projectRoot - absolute directory on the remote host.
	* @returns the stored project record.
	*/
	createProject(projectId, projectRoot) {
		return this.transport.request("remote/projects/create", {
			projectId,
			projectRoot
		});
	}
	/**
	* Resume a stored root session on the remote host.
	* @param projectId - remote project id.
	* @param sessionId - stored root session id.
	* @returns the wire result.
	*/
	resume(projectId, sessionId) {
		return this.transport.request("remote/sessions/resume", {
			projectId,
			sessionId
		});
	}
	/**
	* Queue a user message on a remote root session.
	* @param projectId - remote project id.
	* @param sessionId - root session id.
	* @param contentBlocks - user message blocks.
	* @returns the durable message receipt.
	*/
	prompt(projectId, sessionId, contentBlocks) {
		return this.transport.request("remote/sessions/prompt", {
			projectId,
			sessionId,
			contentBlocks
		});
	}
	/**
	* Cancel active work and queued follow-ups on a remote root session.
	* @param projectId - remote project id.
	* @param sessionId - root session id.
	* @returns the wire result.
	*/
	cancel(projectId, sessionId) {
		return this.transport.request("remote/sessions/cancel", {
			projectId,
			sessionId
		});
	}
	/**
	* Replay and then stream durable session events from a sequence watermark.
	* @param projectId - remote project id.
	* @param sessionId - root session id.
	* @param fromSeq - first sequence to replay.
	* @returns the subscription receipt.
	*/
	subscribe(projectId, sessionId, fromSeq) {
		return this.transport.request("remote/events/subscribe", {
			projectId,
			sessionId,
			fromSeq
		});
	}
	/** Close the SSH transport without stopping the remote host or its sessions. */
	close() {
		this.transport.close();
	}
};
function normalizeProject(entry) {
	if (!/^[a-z][a-z0-9-]{0,63}$/.test(entry.id)) throw new Error(`invalid remote project id: ${JSON.stringify(entry.id)}`);
	if (!isAbsolute(entry.root)) throw new Error(`remote project root must be absolute: ${JSON.stringify(entry.root)}`);
	return {
		id: entry.id,
		root: resolve(entry.root)
	};
}
function parseProjectRegistry(raw, path) {
	let value;
	try {
		value = JSON.parse(raw);
	} catch (error) {
		throw new Error(`failed to parse remote project registry ${path}: ${String(error)}`);
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`remote project registry must hold an object: ${path}`);
	const record = value;
	if (record.version !== 0 || !Array.isArray(record.projects)) throw new Error(`unsupported remote project registry format: ${path}`);
	for (const entry of record.projects) {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new Error(`invalid remote project registry entry: ${path}`);
		const project = entry;
		if (typeof project.id !== "string" || typeof project.root !== "string") throw new Error(`invalid remote project registry entry: ${path}`);
	}
	return record;
}
//#endregion
export { RemoteProjectClient, RemoteProjectHost, RemoteProjectHost as default };
