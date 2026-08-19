import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
//#region lib/types/relay-protocol.js
/** Private WebSocket protocol owned by the remote authority transport. */
/** WebSocket route exposed by a relay-capable remote authority. */
const SESSION_RELAY_PATH = "/api/dsh-remote/session-relay";
/** Validate one relay frame received from a remote process. */
function parseSessionRelayFrame(value) {
	const parsed = JSON.parse(value);
	if (!isRecord(parsed) || typeof parsed.type !== "string") throw new Error("session relay frame must be an object with a type");
	switch (parsed.type) {
		case "hello":
			if (parsed.version === 1 && nonEmptyString(parsed.peerId)) return {
				type: "hello",
				version: 1,
				peerId: parsed.peerId
			};
			break;
		case "ready":
			if (parsed.version === 1) return {
				type: "ready",
				version: 1
			};
			break;
		case "relay": return {
			type: "relay",
			message: parseRelay(parsed.message)
		};
		case "ack":
			if (nonEmptyString(parsed.relayId)) return {
				type: "ack",
				relayId: parsed.relayId
			};
			break;
		case "list":
			if (nonEmptyString(parsed.requestId)) return {
				type: "list",
				requestId: parsed.requestId
			};
			break;
		case "sessions":
			if (nonEmptyString(parsed.requestId) && Array.isArray(parsed.sessions)) return {
				type: "sessions",
				requestId: parsed.requestId,
				sessions: parsed.sessions.map(parseSessionEntry)
			};
			break;
		case "error": if (typeof parsed.message === "string") return {
			type: "error",
			message: parsed.message,
			...typeof parsed.relayId === "string" ? { relayId: parsed.relayId } : {},
			...typeof parsed.requestId === "string" ? { requestId: parsed.requestId } : {}
		};
	}
	throw new Error(`invalid session relay ${parsed.type} frame`);
}
function parseRelay(value) {
	if (!isRecord(value)) throw new Error("session relay message must be an object");
	if (!nonEmptyString(value.relayId)) throw new Error("session relay id must not be empty");
	if (typeof value.content !== "string" || value.content.trim().length === 0) throw new Error("session relay content must not be blank");
	return {
		relayId: value.relayId,
		from: parseAddress(value.from, "from"),
		to: parseAddress(value.to, "to"),
		content: value.content
	};
}
function parseAddress(value, name) {
	if (!isRecord(value) || !nonEmptyString(value.authorityId) || !nonEmptyString(value.sessionId)) throw new Error(`session relay ${name} address is invalid`);
	return {
		authorityId: value.authorityId,
		sessionId: value.sessionId
	};
}
function parseSessionEntry(value) {
	if (!isRecord(value) || !nonEmptyString(value.sessionId) || typeof value.updatedAt !== "number" || typeof value.running !== "boolean") throw new Error("session relay session entry is invalid");
	return {
		sessionId: value.sessionId,
		updatedAt: value.updatedAt,
		running: value.running,
		...typeof value.cwd === "string" ? { cwd: value.cwd } : {}
	};
}
function nonEmptyString(value) {
	return typeof value === "string" && value.length > 0;
}
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
//#endregion
//#region lib/types/relay-socket.js
/** Connected WebSocket adapter for the transport-neutral session relay provider. */
/** One connected remote peer with request acknowledgement and session listing. */
var SessionRelaySocketProvider = class {
	authorityId;
	socket;
	handlers;
	requestTimeoutMs;
	relayRequests = /* @__PURE__ */ new Map();
	listRequests = /* @__PURE__ */ new Map();
	closed = false;
	constructor(authorityId, socket, handlers, requestTimeoutMs) {
		this.authorityId = authorityId;
		this.socket = socket;
		this.handlers = handlers;
		this.requestTimeoutMs = requestTimeoutMs;
		socket.on("message", (data, isBinary) => {
			if (isBinary) {
				this.fail(/* @__PURE__ */ new Error("session relay accepts text WebSocket frames only"));
				return;
			}
			this.handle(data).catch((error) => this.fail(asError(error)));
		});
		socket.once("close", () => this.fail(/* @__PURE__ */ new Error(`session relay authority disconnected: ${authorityId}`)));
		socket.once("error", (error) => this.fail(error));
	}
	async send(message) {
		const promise = this.pending(this.relayRequests, message.relayId);
		this.write({
			type: "relay",
			message
		});
		return promise;
	}
	async listSessions() {
		const requestId = randomUUID();
		const promise = this.pending(this.listRequests, requestId);
		this.write({
			type: "list",
			requestId
		});
		return promise;
	}
	close() {
		if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close();
		this.fail(/* @__PURE__ */ new Error(`session relay authority closed: ${this.authorityId}`));
	}
	async handle(data) {
		const frame = parseSessionRelayFrame(data.toString("utf8"));
		switch (frame.type) {
			case "relay":
				try {
					await this.handlers.receive(frame.message);
					this.write({
						type: "ack",
						relayId: frame.message.relayId
					});
				} catch (error) {
					this.write({
						type: "error",
						relayId: frame.message.relayId,
						message: asError(error).message
					});
				}
				return;
			case "ack":
				this.settle(this.relayRequests, frame.relayId, void 0);
				return;
			case "list":
				try {
					this.write({
						type: "sessions",
						requestId: frame.requestId,
						sessions: await this.handlers.listSessions()
					});
				} catch (error) {
					this.write({
						type: "error",
						requestId: frame.requestId,
						message: asError(error).message
					});
				}
				return;
			case "sessions":
				this.settle(this.listRequests, frame.requestId, frame.sessions);
				return;
			case "error": {
				const error = /* @__PURE__ */ new Error(`session relay peer rejected request: ${frame.message}`);
				if (frame.relayId !== void 0) this.reject(this.relayRequests, frame.relayId, error);
				if (frame.requestId !== void 0) this.reject(this.listRequests, frame.requestId, error);
				return;
			}
			case "hello":
			case "ready": throw new Error(`unexpected ${frame.type} frame after relay handshake`);
		}
	}
	pending(table, id) {
		if (this.closed || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(/* @__PURE__ */ new Error(`session relay authority is not connected: ${this.authorityId}`));
		if (table.has(id)) return Promise.reject(/* @__PURE__ */ new Error(`duplicate session relay request: ${id}`));
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				table.delete(id);
				reject(/* @__PURE__ */ new Error(`session relay request timed out for authority ${this.authorityId}`));
			}, this.requestTimeoutMs);
			table.set(id, {
				resolve,
				reject,
				timer
			});
		});
	}
	settle(table, id, value) {
		const pending = table.get(id);
		if (pending === void 0) return;
		table.delete(id);
		clearTimeout(pending.timer);
		pending.resolve(value);
	}
	reject(table, id, error) {
		const pending = table.get(id);
		if (pending === void 0) return;
		table.delete(id);
		clearTimeout(pending.timer);
		pending.reject(error);
	}
	write(frame) {
		if (this.socket.readyState !== WebSocket.OPEN) throw new Error(`session relay authority is not connected: ${this.authorityId}`);
		this.socket.send(JSON.stringify(frame));
	}
	fail(error) {
		if (this.closed) return;
		this.closed = true;
		for (const [id] of this.relayRequests) this.reject(this.relayRequests, id, error);
		for (const [id] of this.listRequests) this.reject(this.listRequests, id, error);
		this.handlers.closed?.(error);
	}
};
function asError(error) {
	return error instanceof Error ? error : new Error(String(error));
}
//#endregion
export { SESSION_RELAY_PATH as n, parseSessionRelayFrame as r, SessionRelaySocketProvider as t };
