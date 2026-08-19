import { n as SESSION_RELAY_PATH, r as parseSessionRelayFrame, t as SessionRelaySocketProvider } from "./relay-socket-BrTEJvQe.js";
import z from "@deepseek-ai/schemastery";
import { WebSocketServer } from "ws";
//#region lib/types/relay-channel.js
/** Incoming remote-authority relay transport for a DSH Web process. */
const PEER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** Cordis plugin name used by Loader diagnostics. */
const name = "dsh_remote_relay_channel";
/** Services required to expose the relay transport. */
const inject = ["sessionRelay", "webServer"];
const Config = z.object({ requestTimeoutSeconds: z.number().step(1).min(1).max(300).default(30) });
/** Expose the session relay service through the dsh-remote WebSocket protocol. */
function apply(ctx, config = {}) {
	const requestTimeoutMs = (config.requestTimeoutSeconds ?? 30) * 1e3;
	const relay = ctx.get("sessionRelay");
	ctx.effect(() => registerSessionRelayChannel(ctx, relay, requestTimeoutMs), "dsh-remote.relayChannel");
}
function registerSessionRelayChannel(ctx, relay, requestTimeoutMs) {
	const sockets = /* @__PURE__ */ new Map();
	const server = new WebSocketServer({ noServer: true });
	const disposeUpgrade = ctx.webServer.registerUpgrade({
		path: SESSION_RELAY_PATH,
		handler: (_req, socket, head) => {
			server.handleUpgrade(_req, socket, head, (connected) => {
				let initialized = false;
				const timer = setTimeout(() => {
					if (!initialized) connected.close(1008, "session relay handshake timed out");
				}, requestTimeoutMs);
				connected.once("message", (data, isBinary) => {
					clearTimeout(timer);
					if (isBinary) {
						connected.close(1003, "session relay handshake must be text");
						return;
					}
					try {
						const hello = parseSessionRelayFrame(data.toString("utf8"));
						if (hello.type !== "hello" || hello.version !== 1) throw new Error("first session relay frame must be a compatible hello");
						if (!PEER_ID.test(hello.peerId)) throw new Error("invalid session relay peer id");
						initialized = true;
						sockets.get(hello.peerId)?.close(1012, "session relay peer reconnected");
						sockets.set(hello.peerId, connected);
						let disposeProvider = () => {};
						const provider = new SessionRelaySocketProvider(hello.peerId, connected, {
							receive: (message) => relay.receive({
								...message,
								from: {
									authorityId: hello.peerId,
									sessionId: message.from.sessionId
								},
								to: {
									authorityId: "local",
									sessionId: message.to.sessionId
								}
							}),
							listSessions: () => relay.listLocalSessions(),
							closed: () => {
								if (sockets.get(hello.peerId) === connected) sockets.delete(hello.peerId);
								disposeProvider();
							}
						}, requestTimeoutMs);
						disposeProvider = relay.registerProvider(provider);
						connected.send(JSON.stringify({
							type: "ready",
							version: 1
						}));
					} catch (error) {
						connected.close(1008, error instanceof Error ? error.message : String(error));
					}
				});
			});
		}
	});
	return () => {
		disposeUpgrade();
		for (const socket of sockets.values()) socket.close(1001, "session relay server stopped");
		sockets.clear();
		server.close();
	};
}
//#endregion
export { Config, apply, inject, name };
