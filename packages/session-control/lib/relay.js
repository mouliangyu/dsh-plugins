import { randomUUID } from "node:crypto";
//#region lib/types/relay.js
/** Cross-authority session message routing independent of its transport. */
/** Authority name used for sessions owned by the current DSH process. */
const LOCAL_AUTHORITY = "local";
const AUTHORITY_PREFIX = "@authority/";
const RPC_PREFIX = "dsh-session-relay-v1.";
/** Parse a tool-visible local or authority-qualified session id. */
function parseSessionAddress(value) {
	if (!value.startsWith(AUTHORITY_PREFIX)) return {
		authorityId: LOCAL_AUTHORITY,
		sessionId: nonEmpty("session id", value)
	};
	const parts = value.slice(11).split("/");
	if (parts.length !== 2 || parts[0] === void 0 || parts[1] === void 0) throw new Error(`session_control: invalid authority session id ${value}`);
	return {
		authorityId: nonEmpty("authority id", decodeURIComponent(parts[0])),
		sessionId: nonEmpty("session id", decodeURIComponent(parts[1]))
	};
}
/** Format an address for the model-facing session tools. */
function formatSessionAddress(address) {
	return address.authorityId === "local" ? address.sessionId : `${AUTHORITY_PREFIX}${encodeURIComponent(address.authorityId)}/${encodeURIComponent(address.sessionId)}`;
}
/** Create one uniquely identified relay. */
function createSessionRelay(fromSessionId, to, content) {
	return {
		relayId: randomUUID(),
		from: {
			authorityId: LOCAL_AUTHORITY,
			sessionId: fromSessionId
		},
		to,
		content
	};
}
/** Encode durable relay attribution into the official prompt correlation id. */
function relayRpcId(message) {
	const value = JSON.stringify({
		relayId: message.relayId,
		from: message.from
	});
	return `${RPC_PREFIX}${Buffer.from(value, "utf8").toString("base64url")}`;
}
/** Recover relay attribution from an official prompt correlation id. */
function parseRelayRpcId(value) {
	if (!value.startsWith(RPC_PREFIX)) return void 0;
	try {
		const decoded = JSON.parse(Buffer.from(value.slice(21), "base64url").toString("utf8"));
		if (!isRecord(decoded) || typeof decoded.relayId !== "string") return void 0;
		const from = decoded.from;
		if (!isRecord(from) || typeof from.authorityId !== "string" || typeof from.sessionId !== "string" || from.authorityId.length === 0 || from.sessionId.length === 0) return void 0;
		return {
			relayId: decoded.relayId,
			from: {
				authorityId: from.authorityId,
				sessionId: from.sessionId
			}
		};
	} catch {
		return;
	}
}
/** Build the process-local session relay service. */
function createSessionRelayService(ctx) {
	const providers = /* @__PURE__ */ new Map();
	return {
		registerProvider(provider) {
			if (provider.authorityId === "local") throw new Error("session_control: local is reserved for this DSH authority");
			if (providers.has(provider.authorityId)) throw new Error(`session_control: relay provider already registered: ${provider.authorityId}`);
			providers.set(provider.authorityId, provider);
			return () => {
				if (providers.get(provider.authorityId) === provider) providers.delete(provider.authorityId);
			};
		},
		async send(message) {
			if (message.to.authorityId === "local") {
				await deliverRelay(ctx, message);
				return;
			}
			const provider = providers.get(message.to.authorityId);
			if (provider === void 0) throw new Error(`session_control: relay authority is not connected: ${message.to.authorityId}`);
			await provider.send(message);
		},
		receive: (message) => deliverRelay(ctx, message),
		async listSessions() {
			return (await Promise.all([...providers.values()].map(async (provider) => ({
				authorityId: provider.authorityId,
				sessions: await provider.listSessions()
			})))).flatMap(({ authorityId, sessions }) => sessions.map((entry) => ({
				...entry,
				sessionId: formatSessionAddress({
					authorityId,
					sessionId: entry.sessionId
				})
			})));
		},
		async listLocalSessions() {
			const response = await ctx.apiProxy.sessions.list({
				rpcId: randomUUID(),
				payload: {}
			});
			if (!response.result.ok) throw new Error(`session_control: session listing failed: ${response.result.error.message}`);
			return response.result.value.items.map((item) => ({
				sessionId: String(item.sessionId),
				updatedAt: item.updatedAt,
				running: item.running,
				...item.cwd === void 0 ? {} : { cwd: item.cwd }
			}));
		}
	};
}
async function deliverRelay(ctx, message) {
	if (message.to.authorityId !== "local") throw new Error(`session_control: received relay for non-local authority ${message.to.authorityId}`);
	const target = message.to.sessionId;
	if (await hasRelay(ctx, target, message.relayId)) return;
	const response = await ctx.apiProxy.sessions.prompt({
		rpcId: relayRpcId(message),
		payload: {
			sessionId: target,
			mode: "queue",
			content: [{
				type: "text",
				text: message.content
			}]
		}
	});
	if (!response.result.ok) throw new Error(`session_control: relay delivery failed: ${response.result.error.message}`);
}
async function hasRelay(ctx, sessionId, relayId) {
	return (ctx.agents.get(sessionId)?.session.events ?? (await ctx.sessionPersistence.inspect(sessionId)).events).some((event) => {
		if (!isRecord(event) || event.type !== "user/message" || !isRecord(event.data)) return false;
		const source = event.data.source;
		if (!isRecord(source) || typeof source.rpcId !== "string") return false;
		return parseRelayRpcId(source.rpcId)?.relayId === relayId;
	});
}
/** Find the most recent external or local relay sender in an Agent log. */
function latestRelayAddress(agent) {
	for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
		const event = agent.session.events[index];
		if (!isRecord(event) || event.type !== "user/message" || !isRecord(event.data)) continue;
		const source = event.data.source;
		if (!isRecord(source)) continue;
		if (typeof source.rpcId === "string") {
			const relay = parseRelayRpcId(source.rpcId);
			if (relay !== void 0) return relay.from;
		}
		if (source.kind === "coordinator" && source.form === "relay" && typeof source.senderSessionId === "string" && source.senderSessionId.length > 0 && source.senderSessionId !== String(agent.id)) return {
			authorityId: LOCAL_AUTHORITY,
			sessionId: source.senderSessionId
		};
	}
	throw new Error("session_control: no relayed session message is available to reply to");
}
function nonEmpty(name, value) {
	const normalized = value.trim();
	if (normalized.length === 0) throw new Error(`session_control: ${name} must not be blank`);
	return normalized;
}
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
//#endregion
export { LOCAL_AUTHORITY, createSessionRelay, createSessionRelayService, formatSessionAddress, latestRelayAddress, parseRelayRpcId, parseSessionAddress, relayRpcId };
