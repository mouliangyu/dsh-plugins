import { n as SESSION_RELAY_PATH, t as SessionRelaySocketProvider } from "./relay-socket-BrTEJvQe.js";
import { spawn } from "node:child_process";
import { request } from "node:http";
import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { WebSocket, WebSocketServer } from "ws";
import { glob, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import SSHConfig from "ssh-config";
import "dsh-session-control/relay";
import { createServer } from "node:net";
//#region lib/types/ssh-config.js
/** OpenSSH host-alias discovery for the local Web plugin. */
const MAX_CONFIG_FILES = 256;
const EXPLICIT_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
/**
* List explicit OpenSSH Host aliases without contacting any remote machine.
* @param options Configuration paths used for discovery; defaults to the user's `~/.ssh` tree.
* @returns Sorted aliases that can be selected for an SSH connection.
*/
async function discoverSshHostAliases(options = {}) {
	const sshDirectory = options.sshDirectory ?? resolve(homedir(), ".ssh");
	const root = options.configPath ?? resolve(sshDirectory, "config");
	const aliases = /* @__PURE__ */ new Set();
	const visited = /* @__PURE__ */ new Set();
	const visit = async (path) => {
		const absolute = resolve(path);
		if (visited.has(absolute)) return;
		if (visited.size >= MAX_CONFIG_FILES) throw new Error(`SSH config includes more than ${MAX_CONFIG_FILES} files`);
		visited.add(absolute);
		let text;
		try {
			text = await readFile(absolute, "utf8");
		} catch (error) {
			if (isMissingFile(error)) return;
			throw error;
		}
		const config = SSHConfig.parse(text);
		collectAliases(config, aliases);
		for (const pattern of collectIncludes(config)) {
			const expanded = expandInclude(pattern, sshDirectory);
			for await (const included of glob(expanded)) await visit(included);
		}
	};
	await visit(root);
	return [...aliases].sort((left, right) => left.localeCompare(right));
}
function collectAliases(config, aliases) {
	walk(config, (line) => {
		if (line.param.toLowerCase() !== "host") return;
		for (const alias of values(line)) if (EXPLICIT_HOST.test(alias)) aliases.add(alias);
	});
}
function collectIncludes(config) {
	const includes = [];
	walk(config, (line) => {
		if (line.param.toLowerCase() === "include") includes.push(...values(line));
	});
	return includes;
}
function walk(config, listener) {
	for (const line of config) {
		if (!("param" in line)) continue;
		listener(line);
		if ("config" in line) walk(line.config, listener);
	}
}
function values(line) {
	return typeof line.value === "string" ? [line.value] : line.value.map((value) => value.val);
}
function expandInclude(pattern, sshDirectory) {
	if (pattern === "~") return resolve(sshDirectory, "..");
	if (pattern.startsWith("~/")) return resolve(sshDirectory, "..", pattern.slice(2));
	return isAbsolute(pattern) ? pattern : resolve(sshDirectory, pattern);
}
function isMissingFile(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
//#endregion
//#region lib/types/session-relay.js
/** Host-side WebSocket provider for the session-control relay service. */
/** One Host-side remote authority relay provider. */
var RemoteSessionRelayProvider = class RemoteSessionRelayProvider {
	authorityId;
	peerId;
	socketProvider;
	socket;
	constructor(options, socket) {
		this.authorityId = options.authorityId;
		this.peerId = options.peerId;
		this.socket = socket;
		this.socketProvider = new SessionRelaySocketProvider(options.authorityId, socket, {
			receive: (message) => options.receive({
				...message,
				from: {
					authorityId: options.authorityId,
					sessionId: message.from.sessionId
				},
				to: {
					authorityId: "local",
					sessionId: message.to.sessionId
				}
			}),
			listSessions: options.listSessions ?? (async () => []),
			closed: options.closed
		}, options.requestTimeoutMs);
	}
	/** Open and handshake a provider through an existing SSH local forward. */
	static async connect(options) {
		const socket = await openRelaySocket(options);
		return new RemoteSessionRelayProvider(options, socket);
	}
	async send(message) {
		await this.socketProvider.send({
			...message,
			from: {
				authorityId: this.peerId,
				sessionId: message.from.sessionId
			},
			to: {
				authorityId: "local",
				sessionId: message.to.sessionId
			}
		});
	}
	async listSessions() {
		return this.socketProvider.listSessions();
	}
	async close() {
		this.socketProvider.close();
		if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close();
	}
};
async function openRelaySocket(options) {
	const socket = new WebSocket(`ws://127.0.0.1:${String(options.forward.localPort)}${SESSION_RELAY_PATH}`, { headers: {
		host: `127.0.0.1:${String(options.forward.localPort)}`,
		origin: `http://127.0.0.1:${String(options.forward.localPort)}`
	} });
	await new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			socket.close();
			reject(/* @__PURE__ */ new Error(`session relay handshake timed out for ${options.authorityId}`));
		}, options.requestTimeoutMs);
		const fail = (error) => {
			clearTimeout(timer);
			reject(error);
		};
		socket.once("error", fail);
		socket.once("open", () => {
			socket.send(JSON.stringify({
				type: "hello",
				version: 1,
				peerId: options.peerId
			}));
		});
		socket.once("message", (data, isBinary) => {
			if (isBinary) {
				fail(/* @__PURE__ */ new Error("session relay handshake must be text"));
				return;
			}
			try {
				const frame = JSON.parse(data.toString("utf8"));
				if (frame.type !== "ready" || frame.version !== 1) {
					fail(/* @__PURE__ */ new Error("remote session relay rejected the protocol"));
					return;
				}
				clearTimeout(timer);
				socket.removeListener("error", fail);
				resolve();
			} catch (error) {
				fail(error instanceof Error ? error : new Error(String(error)));
			}
		});
	});
	return socket;
}
//#endregion
//#region lib/types/transparent.js
/** SSH transport for an official remote DSH Web/API authority. */
/** Reserve a loopback port without exposing it to other hosts. */
async function reservePort(port) {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen({
			host: "127.0.0.1",
			port: port ?? 0
		}, () => {
			server.off("error", reject);
			resolve();
		});
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		server.close();
		throw new Error("SSH forward did not receive a loopback port");
	}
	return {
		server,
		localPort: address.port
	};
}
/**
* Open `127.0.0.1:<localPort> -> remote loopback:<remotePort>` through OpenSSH.
* No application payload is decoded or translated by this transport.
*
* @param options - SSH alias and official remote API port.
* @returns the live forward and its loopback port.
*/
async function openRemoteApiForward(options) {
	const reserved = await reservePort(options.localPort);
	await new Promise((resolve, reject) => {
		reserved.server.close((error) => error === void 0 ? resolve() : reject(error));
	});
	const launch = options.spawn ?? spawn;
	const timeout = options.connectTimeoutSeconds ?? 10;
	const process = launch("ssh", [
		"-N",
		"-T",
		"-o",
		"BatchMode=yes",
		"-o",
		"ExitOnForwardFailure=yes",
		"-o",
		`ConnectTimeout=${timeout}`,
		"-L",
		`127.0.0.1:${reserved.localPort}:127.0.0.1:${options.remotePort}`,
		options.host
	], { stdio: [
		"pipe",
		"pipe",
		"pipe"
	] });
	let stderr = "";
	process.stderr.setEncoding("utf8");
	process.stderr.on("data", (chunk) => {
		stderr = (stderr + chunk).slice(-4096);
	});
	const close = async () => {
		if (process.exitCode !== null || process.signalCode !== null) return;
		process.kill("SIGTERM");
		await new Promise((resolve) => {
			process.once("exit", () => {
				resolve();
			});
		});
	};
	await new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(/* @__PURE__ */ new Error(`SSH forward timed out after ${timeout}s`));
			process.kill("SIGTERM");
		}, timeout * 1e3);
		process.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		process.stderr.once("data", () => {
			if (stderr.includes("Permission denied") || stderr.includes("Could not resolve")) {
				clearTimeout(timer);
				reject(new Error(stderr.trim()));
			}
		});
		setImmediate(() => {
			clearTimeout(timer);
			resolve();
		});
	});
	return {
		localPort: reserved.localPort,
		remotePort: options.remotePort,
		process,
		close
	};
}
//#endregion
//#region lib/types/local.js
/** Local SSH authority manager and transparent official-API proxy. */
const name = "dsh-remote";
const inject = [
	"sessionRelay",
	"settings",
	"webServer"
];
const CONTROL_PATH = "/dsh-remote/control";
const AUTHORITY_PREFIX = "/dsh-remote/authority";
const MAX_BODY_BYTES = 1048576;
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const SSH_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const SETTINGS_NS = settingsNamespace("dsh-remote");
const Config = z.object({
	connections: z.array(z.object({
		id: z.string().required(),
		host: z.string().required(),
		remotePort: z.number().min(1).max(65535).default(3090)
	})).default([]),
	sshConnectTimeoutSeconds: z.number().min(1).max(120).default(10),
	autoConnect: z.boolean().default(true)
});
var RemoteAuthorityManager = class {
	settings;
	webServer;
	connectTimeoutSeconds;
	sessionRelay;
	forwards = /* @__PURE__ */ new Map();
	errors = /* @__PURE__ */ new Map();
	relayErrors = /* @__PURE__ */ new Map();
	upgradeDisposers = /* @__PURE__ */ new Map();
	relayProviders = /* @__PURE__ */ new Map();
	relayDisposers = /* @__PURE__ */ new Map();
	constructor(settings, webServer, connectTimeoutSeconds, sessionRelay) {
		this.settings = settings;
		this.webServer = webServer;
		this.connectTimeoutSeconds = connectTimeoutSeconds;
		this.sessionRelay = sessionRelay;
		for (const connection of settings.get().connections) this.registerUpgrades(connection.id);
	}
	state() {
		return { connections: this.settings.get().connections.map((connection) => ({
			...connection,
			connected: this.forwards.has(connection.id),
			relayConnected: this.relayProviders.has(connection.id),
			basePath: authorityBasePath(connection.id),
			...this.errors.has(connection.id) ? { error: this.errors.get(connection.id) } : {},
			...this.relayErrors.has(connection.id) ? { relayError: this.relayErrors.get(connection.id) } : {}
		})) };
	}
	async run(action) {
		switch (action.action) {
			case "discoverHosts": return { hosts: (await discoverSshHostAliases()).map((alias) => ({ alias })) };
			case "saveConnection": {
				validateConnection(action.connection);
				await this.disconnect(action.connection.id);
				const next = [...this.settings.get().connections.filter((entry) => entry.id !== action.connection.id), action.connection];
				await this.settings.replace({ connections: next });
				this.registerUpgrades(action.connection.id);
				return this.state();
			}
			case "removeConnection":
				await this.disconnect(action.connectionId);
				this.upgradeDisposers.get(action.connectionId)?.();
				this.upgradeDisposers.delete(action.connectionId);
				await this.settings.replace({ connections: this.settings.get().connections.filter((entry) => entry.id !== action.connectionId) });
				return this.state();
			case "connect":
				await this.connect(action.connectionId);
				return this.state();
			case "restart":
				await this.restart(action.connectionId);
				return this.state();
			case "disconnect":
				await this.disconnect(action.connectionId);
				return this.state();
		}
	}
	async connect(connectionId) {
		if (this.forwards.has(connectionId)) return;
		const config = this.connectionConfig(connectionId);
		let forward;
		try {
			await ensureRemoteWebHost(config, this.connectTimeoutSeconds);
			forward = await openRemoteApiForward({
				host: config.host,
				remotePort: config.remotePort,
				connectTimeoutSeconds: this.connectTimeoutSeconds
			});
			await waitForTcp(forward.localPort, this.connectTimeoutSeconds * 1e3);
			this.forwards.set(connectionId, forward);
			try {
				let provider;
				provider = await RemoteSessionRelayProvider.connect({
					authorityId: connectionId,
					peerId: `host:${connectionId}`,
					forward,
					requestTimeoutMs: this.connectTimeoutSeconds * 1e3,
					receive: (message) => this.receiveRelay(connectionId, message),
					listSessions: () => this.sessionRelay.listLocalSessions(),
					closed: (error) => {
						if (provider !== void 0) this.relayClosed(connectionId, provider, error);
					}
				});
				this.relayProviders.set(connectionId, provider);
				this.relayDisposers.set(connectionId, this.sessionRelay.registerProvider(provider));
				this.relayErrors.delete(connectionId);
			} catch (error) {
				this.relayErrors.set(connectionId, relayUnavailableMessage(error));
			}
			this.errors.delete(connectionId);
			forward.process.once("exit", (code, signal) => {
				if (this.forwards.get(connectionId) !== forward) return;
				this.forwards.delete(connectionId);
				this.closeRelay(connectionId);
				this.errors.set(connectionId, `ssh forward exited (${code === null ? signal : String(code)})`);
			});
		} catch (error) {
			this.forwards.delete(connectionId);
			await this.closeRelay(connectionId);
			await forward?.close().catch(() => void 0);
			const message = errorMessage(error);
			this.errors.set(connectionId, message);
			throw new Error(message);
		}
	}
	async disconnect(connectionId) {
		const forward = this.forwards.get(connectionId);
		if (forward === void 0) return;
		this.forwards.delete(connectionId);
		await this.closeRelay(connectionId);
		await forward.close();
	}
	/** Restart the DSH Web process owned by this plugin before reconnecting. */
	async restart(connectionId) {
		await this.disconnect(connectionId);
		const config = this.connectionConfig(connectionId);
		try {
			await ensureRemoteWebHost(config, this.connectTimeoutSeconds, true);
			this.errors.delete(connectionId);
		} catch (error) {
			const message = errorMessage(error);
			this.errors.set(connectionId, message);
			throw new Error(message);
		}
	}
	proxyHttp(connectionId, req, res) {
		const forward = this.forwards.get(connectionId);
		if (forward === void 0) {
			json(res, 503, { error: `remote authority is not connected: ${connectionId}` });
			return;
		}
		const upstreamPath = upstreamApiPath(connectionId, req.url);
		if (upstreamPath === void 0) {
			json(res, 404, { error: "unknown remote API path" });
			return;
		}
		const upstream = request({
			host: "127.0.0.1",
			port: forward.localPort,
			method: req.method,
			path: upstreamPath,
			headers: upstreamHeaders(req.headers, forward.localPort)
		}, (response) => {
			res.writeHead(response.statusCode ?? 502, response.headers);
			response.pipe(res);
		});
		upstream.once("error", (error) => {
			if (!res.headersSent) json(res, 502, { error: error.message });
			else res.destroy(error);
		});
		req.pipe(upstream);
	}
	proxyUpgrade(connectionId, apiPath, req, socket, head) {
		const forward = this.forwards.get(connectionId);
		if (forward === void 0) {
			rejectUpgrade(socket, 503, "remote authority is not connected");
			return;
		}
		const upstream = new WebSocket(`ws://127.0.0.1:${String(forward.localPort)}${apiPath}`, { headers: upstreamHeaders(req.headers, forward.localPort) });
		const server = new WebSocketServer({ noServer: true });
		let accepted = false;
		const fail = (error) => {
			if (!accepted) rejectUpgrade(socket, 502, error.message);
			upstream.close();
			server.close();
		};
		upstream.once("error", fail);
		upstream.once("open", () => {
			server.handleUpgrade(req, socket, head, (downstream) => {
				accepted = true;
				downstream.on("message", (data, isBinary) => {
					relayWebSocketMessage(upstream, data, isBinary);
				});
				upstream.on("message", (data, isBinary) => {
					relayWebSocketMessage(downstream, data, isBinary);
				});
				downstream.once("close", () => {
					upstream.close();
					server.close();
				});
				upstream.once("close", () => {
					downstream.close();
					server.close();
				});
			});
		});
	}
	async dispose() {
		await Promise.all([...this.forwards.keys()].map((id) => this.disconnect(id)));
		for (const dispose of this.upgradeDisposers.values()) dispose();
		this.upgradeDisposers.clear();
	}
	async closeRelay(connectionId) {
		this.relayDisposers.get(connectionId)?.();
		this.relayDisposers.delete(connectionId);
		const provider = this.relayProviders.get(connectionId);
		this.relayProviders.delete(connectionId);
		await provider?.close();
	}
	relayClosed(connectionId, provider, error) {
		if (this.relayProviders.get(connectionId) !== provider) return;
		this.relayDisposers.get(connectionId)?.();
		this.relayDisposers.delete(connectionId);
		this.relayProviders.delete(connectionId);
		this.relayErrors.set(connectionId, relayUnavailableMessage(error));
	}
	async receiveRelay(connectionId, message) {
		await this.sessionRelay.receive({
			...message,
			from: {
				authorityId: message.from.authorityId === "local" ? connectionId : message.from.authorityId,
				sessionId: message.from.sessionId
			},
			to: {
				authorityId: "local",
				sessionId: message.to.sessionId
			}
		});
	}
	connectionConfig(connectionId) {
		const config = this.settings.get().connections.find((entry) => entry.id === connectionId);
		if (config === void 0) throw new Error(`unknown remote connection: ${connectionId}`);
		return config;
	}
	registerUpgrades(connectionId) {
		if (this.upgradeDisposers.has(connectionId)) return;
		const disposers = ["/api/events.mux", "/api/events.host"].map((apiPath) => this.webServer.registerUpgrade({
			path: `${authorityBasePath(connectionId)}${apiPath}`,
			handler: (req, socket, head) => {
				this.proxyUpgrade(connectionId, apiPath, req, socket, head);
			}
		}));
		this.upgradeDisposers.set(connectionId, () => {
			for (const dispose of disposers) dispose();
		});
	}
};
/** Mount the local connection registry and transparent proxy routes. */
function apply(ctx, config = {}) {
	const base = { connections: config.connections ?? [] };
	for (const connection of base.connections) validateConnection(connection);
	const settings = ctx.settings.register(SETTINGS_NS, z.object({ connections: z.array(z.object({
		id: z.string().required(),
		host: z.string().required(),
		remotePort: z.number().min(1).max(65535).default(3090)
	})).default([]) }), { base });
	const manager = new RemoteAuthorityManager(settings, ctx.webServer, config.sshConnectTimeoutSeconds ?? 10, ctx.get("sessionRelay"));
	ctx.effect(() => () => manager.dispose(), "dsh-remote.authorities");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: CONTROL_PATH,
		handler: async (req, res) => {
			if (req.method === "GET") {
				json(res, 200, manager.state());
				return;
			}
			if (req.method !== "POST") {
				json(res, 405, { error: "method not allowed" });
				return;
			}
			try {
				json(res, 200, { value: await manager.run(await readAction(req)) });
			} catch (error) {
				json(res, 400, { error: errorMessage(error) });
			}
		}
	}), "dsh-remote.control");
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: AUTHORITY_PREFIX,
		handler: (req, res) => {
			const connectionId = authorityIdFromRequest(req.url);
			if (connectionId === void 0) {
				json(res, 404, { error: "unknown remote authority path" });
				return;
			}
			manager.proxyHttp(connectionId, req, res);
		}
	}), "dsh-remote.proxy");
	if (config.autoConnect ?? true) for (const connection of settings.get().connections) manager.connect(connection.id).catch(() => void 0);
}
function authorityBasePath(id) {
	return `${AUTHORITY_PREFIX}/${encodeURIComponent(id)}`;
}
function authorityIdFromRequest(rawUrl) {
	const pathname = new URL(rawUrl ?? "/", "http://localhost").pathname;
	const prefix = `${AUTHORITY_PREFIX}/`;
	if (!pathname.startsWith(prefix)) return void 0;
	const encoded = pathname.slice(prefix.length).split("/", 1)[0];
	if (encoded === void 0 || encoded === "") return void 0;
	return decodeURIComponent(encoded);
}
function upstreamApiPath(connectionId, rawUrl) {
	const url = new URL(rawUrl ?? "/", "http://localhost");
	const prefix = authorityBasePath(connectionId);
	if (!url.pathname.startsWith(`${prefix}/api/`)) return void 0;
	return `${url.pathname.slice(prefix.length)}${url.search}`;
}
function upstreamHeaders(headers, port) {
	const authority = `127.0.0.1:${String(port)}`;
	return {
		...headers,
		host: authority,
		origin: `http://${authority}`,
		"sec-fetch-site": "same-origin"
	};
}
function validateConnection(connection) {
	if (!ID.test(connection.id)) throw new Error("connection id must start with a lowercase letter and contain only lowercase letters, digits, or dashes");
	if (!SSH_HOST.test(connection.host)) throw new Error("host must be an OpenSSH hostname or alias without command-line options");
	if (!Number.isSafeInteger(connection.remotePort) || connection.remotePort < 1 || connection.remotePort > 65535) throw new Error("remote port must be between 1 and 65535");
}
async function ensureRemoteWebHost(config, timeoutSeconds, restart = false) {
	const script = `set -eu
command -v dsh >/dev/null 2>&1 || { echo 'official dsh CLI is not installed on the remote host' >&2; exit 127; }
port=${String(config.remotePort)}
probe() { "$(command -v node)" -e "const n=require('node:net');const s=n.connect({host:'127.0.0.1',port:Number(process.argv[1])},()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),500)" "$port"; }
${restart ? `
dsh_home="\${DSH_HOME:-$HOME/.dsh}"
pid_file="$dsh_home/remote-web.pid"
if test -f "$pid_file"; then
  pid="$(cat "$pid_file")"
  case "$pid" in (*[!0-9]*|'') echo 'remote DSH PID file is invalid' >&2; exit 1;; esac
  if kill -0 "$pid" 2>/dev/null; then
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    case "$command" in (*dsh*--profile*web*) kill "$pid";; (*) echo 'remote DSH PID file does not identify a DSH Web process' >&2; exit 1;; esac
    attempt=0
    while kill -0 "$pid" 2>/dev/null && test "$attempt" -lt 40; do attempt=$((attempt + 1)); sleep 0.25; done
    if kill -0 "$pid" 2>/dev/null; then echo 'remote DSH Web process did not stop' >&2; exit 1; fi
  fi
  rm -f "$pid_file"
fi
if probe; then echo 'remote DSH port is still occupied after stopping the owned process' >&2; exit 1; fi
` : ""}
if probe; then exit 0; fi
dsh_home="\${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$dsh_home"
nohup dsh --profile web --host 127.0.0.1 --port "$port" >> "$dsh_home/remote-web.log" 2>&1 </dev/null &
echo "$!" > "$dsh_home/remote-web.pid"
attempt=0
while test "$attempt" -lt 60; do
  if probe; then exit 0; fi
  attempt=$((attempt + 1))
  sleep 0.25
done
tail -n 40 "$dsh_home/remote-web.log" >&2 || true
exit 1`;
	await runSshScript(config.host, script, timeoutSeconds * 1e3 + 2e4);
}
async function runSshScript(host, script, timeoutMs) {
	await new Promise((resolve, reject) => {
		const child = spawn("ssh", [
			"-T",
			"-o",
			"BatchMode=yes",
			host,
			"sh",
			"-s"
		], { stdio: [
			"pipe",
			"ignore",
			"pipe"
		] });
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			reject(/* @__PURE__ */ new Error("remote DSH startup timed out"));
		}, timeoutMs);
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk) => {
			stderr = (stderr + chunk).slice(-8192);
		});
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("exit", (code, signal) => {
			clearTimeout(timer);
			if (code === 0) resolve();
			else reject(new Error(stderr.trim() || `ssh exited (${code === null ? signal : String(code)})`));
		});
		child.stdin.end(script);
	});
}
async function waitForTcp(port, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await new Promise((resolve) => {
			const req = request({
				host: "127.0.0.1",
				port,
				method: "HEAD",
				path: "/"
			});
			req.once("response", (response) => {
				response.resume();
				resolve(true);
			});
			req.once("error", () => {
				resolve(false);
			});
			req.end();
		})) return;
		await new Promise((resolve) => {
			setTimeout(resolve, 100);
		});
	}
	throw new Error("SSH forward did not reach the remote DSH Web Host");
}
async function readAction(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > MAX_BODY_BYTES) throw new Error("request body too large");
		chunks.push(buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function rejectUpgrade(socket, status, message) {
	if (!socket.destroyed) socket.end(`HTTP/1.1 ${String(status)} Bad Gateway\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${message}`);
}
function json(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function relayUnavailableMessage(error) {
	const detail = errorMessage(error);
	return `session relay unavailable; install dsh-session-control and dsh-remote in the remote Web profile${detail === "" ? "" : ` (${detail})`}`;
}
/** Forward one WebSocket message without changing its text/binary opcode. */
function relayWebSocketMessage(target, data, isBinary) {
	if (target.readyState === WebSocket.OPEN) target.send(data, { binary: isBinary });
}
//#endregion
export { Config, apply, inject, name, relayWebSocketMessage };
