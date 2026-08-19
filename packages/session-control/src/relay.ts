/** Cross-authority session message routing independent of its transport. */

import { randomUUID } from "node:crypto";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { Context } from "@deepseek-ai/cordis";
import type { SessionId } from "@deepseek-ai/dsh-session";

/** Authority name used for sessions owned by the current DSH process. */
export const LOCAL_AUTHORITY = "local";
const AUTHORITY_PREFIX = "@authority/";
const RPC_PREFIX = "dsh-session-relay-v1.";

/** Stable address for one session in one DSH authority. */
export interface SessionAddress {
  readonly authorityId: string;
  readonly sessionId: string;
}

/** One complete agent-to-agent text message. */
export interface SessionRelay {
  readonly relayId: string;
  readonly from: SessionAddress;
  readonly to: SessionAddress;
  readonly content: string;
}

/** Session summary returned by an external relay provider. */
export interface RelaySessionEntry {
  readonly sessionId: string;
  readonly updatedAt: number;
  readonly running: boolean;
  readonly cwd?: string;
}

/** Authority transport registered with the session relay service. */
export interface SessionRelayProvider {
  readonly authorityId: string;
  send(message: SessionRelay): Promise<void>;
  listSessions(): Promise<readonly RelaySessionEntry[]>;
}

/** Host-local service consumed by tools and authority transports. */
export interface SessionRelayService {
  registerProvider(provider: SessionRelayProvider): () => void;
  send(message: SessionRelay): Promise<void>;
  receive(message: SessionRelay): Promise<void>;
  listSessions(): Promise<readonly RelaySessionEntry[]>;
  listLocalSessions(): Promise<readonly RelaySessionEntry[]>;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Process-local cross-authority session relay registry. */
    sessionRelay: SessionRelayService;
  }
}

/** Parse a tool-visible local or authority-qualified session id. */
export function parseSessionAddress(value: string): SessionAddress {
  if (!value.startsWith(AUTHORITY_PREFIX)) {
    return { authorityId: LOCAL_AUTHORITY, sessionId: nonEmpty("session id", value) };
  }
  const parts = value.slice(AUTHORITY_PREFIX.length).split("/");
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
    throw new Error(`session_control: invalid authority session id ${value}`);
  }
  return {
    authorityId: nonEmpty("authority id", decodeURIComponent(parts[0])),
    sessionId: nonEmpty("session id", decodeURIComponent(parts[1])),
  };
}

/** Format an address for the model-facing session tools. */
export function formatSessionAddress(address: SessionAddress): string {
  return address.authorityId === LOCAL_AUTHORITY
    ? address.sessionId
    : `${AUTHORITY_PREFIX}${encodeURIComponent(address.authorityId)}/${encodeURIComponent(address.sessionId)}`;
}

/** Create one uniquely identified relay. */
export function createSessionRelay(
  fromSessionId: string,
  to: SessionAddress,
  content: string,
): SessionRelay {
  return {
    relayId: randomUUID(),
    from: { authorityId: LOCAL_AUTHORITY, sessionId: fromSessionId },
    to,
    content,
  };
}

/** Encode durable relay attribution into the official prompt correlation id. */
export function relayRpcId(message: SessionRelay): string {
  const value = JSON.stringify({ relayId: message.relayId, from: message.from });
  return `${RPC_PREFIX}${Buffer.from(value, "utf8").toString("base64url")}`;
}

/** Recover relay attribution from an official prompt correlation id. */
export function parseRelayRpcId(value: string): {
  relayId: string;
  from: SessionAddress;
} | undefined {
  if (!value.startsWith(RPC_PREFIX)) return undefined;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value.slice(RPC_PREFIX.length), "base64url").toString("utf8"),
    );
    if (!isRecord(decoded) || typeof decoded.relayId !== "string") return undefined;
    const from = decoded.from;
    if (
      !isRecord(from) ||
      typeof from.authorityId !== "string" ||
      typeof from.sessionId !== "string" ||
      from.authorityId.length === 0 ||
      from.sessionId.length === 0
    ) return undefined;
    return {
      relayId: decoded.relayId,
      from: { authorityId: from.authorityId, sessionId: from.sessionId },
    };
  } catch {
    return undefined;
  }
}

/** Build the process-local session relay service. */
export function createSessionRelayService(ctx: Context): SessionRelayService {
  const providers = new Map<string, SessionRelayProvider>();
  return {
    registerProvider(provider) {
      if (provider.authorityId === LOCAL_AUTHORITY) {
        throw new Error("session_control: local is reserved for this DSH authority");
      }
      if (providers.has(provider.authorityId)) {
        throw new Error(`session_control: relay provider already registered: ${provider.authorityId}`);
      }
      providers.set(provider.authorityId, provider);
      return () => {
        if (providers.get(provider.authorityId) === provider) providers.delete(provider.authorityId);
      };
    },
    async send(message) {
      if (message.to.authorityId === LOCAL_AUTHORITY) {
        await deliverRelay(ctx, message);
        return;
      }
      const provider = providers.get(message.to.authorityId);
      if (provider === undefined) {
        throw new Error(`session_control: relay authority is not connected: ${message.to.authorityId}`);
      }
      await provider.send(message);
    },
    receive: (message) => deliverRelay(ctx, message),
    async listSessions() {
      const results = await Promise.all(
        [...providers.values()].map(async provider => ({
          authorityId: provider.authorityId,
          sessions: await provider.listSessions(),
        })),
      );
      return results.flatMap(({ authorityId, sessions }) => sessions.map(entry => ({
        ...entry,
        sessionId: formatSessionAddress({ authorityId, sessionId: entry.sessionId }),
      })));
    },
    async listLocalSessions() {
      const response = await ctx.apiProxy.sessions.list({
        rpcId: randomUUID(),
        payload: {},
      });
      if (!response.result.ok) {
        throw new Error(`session_control: session listing failed: ${response.result.error.message}`);
      }
      return response.result.value.items.map(item => ({
        sessionId: String(item.sessionId),
        updatedAt: item.updatedAt,
        running: item.running,
        ...(item.cwd === undefined ? {} : { cwd: item.cwd }),
      }));
    },
  };
}

async function deliverRelay(ctx: Context, message: SessionRelay): Promise<void> {
  if (message.to.authorityId !== LOCAL_AUTHORITY) {
    throw new Error(`session_control: received relay for non-local authority ${message.to.authorityId}`);
  }
  const target = message.to.sessionId as SessionId;
  if (await hasRelay(ctx, target, message.relayId)) return;
  const response = await ctx.apiProxy.sessions.prompt({
    rpcId: relayRpcId(message),
    payload: {
      sessionId: target,
      mode: "queue",
      content: [{ type: "text", text: message.content }],
    },
  });
  if (!response.result.ok) {
    throw new Error(`session_control: relay delivery failed: ${response.result.error.message}`);
  }
}

async function hasRelay(ctx: Context, sessionId: SessionId, relayId: string): Promise<boolean> {
  const live = ctx.agents.get(sessionId);
  const events = live?.session.events ?? (await ctx.sessionPersistence.inspect(sessionId)).events;
  return events.some(event => {
    if (!isRecord(event) || event.type !== "user/message" || !isRecord(event.data)) return false;
    const source = event.data.source;
    if (!isRecord(source) || typeof source.rpcId !== "string") return false;
    return parseRelayRpcId(source.rpcId)?.relayId === relayId;
  });
}

/** Find the most recent external or local relay sender in an Agent log. */
export function latestRelayAddress(agent: Agent): SessionAddress {
  for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
    const event = agent.session.events[index];
    if (!isRecord(event) || event.type !== "user/message" || !isRecord(event.data)) continue;
    const source = event.data.source;
    if (!isRecord(source)) continue;
    if (typeof source.rpcId === "string") {
      const relay = parseRelayRpcId(source.rpcId);
      if (relay !== undefined) return relay.from;
    }
    if (
      source.kind === "coordinator" &&
      source.form === "relay" &&
      typeof source.senderSessionId === "string" &&
      source.senderSessionId.length > 0 &&
      source.senderSessionId !== String(agent.id)
    ) {
      return { authorityId: LOCAL_AUTHORITY, sessionId: source.senderSessionId };
    }
  }
  throw new Error("session_control: no relayed session message is available to reply to");
}

function nonEmpty(name: string, value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`session_control: ${name} must not be blank`);
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
