/** Private WebSocket protocol owned by the remote authority transport. */

import type { RelaySessionEntry, SessionAddress, SessionRelay } from "dsh-session-control/relay";

/** WebSocket route exposed by a relay-capable remote authority. */
export const SESSION_RELAY_PATH = "/api/dsh-remote/session-relay";
/** Current remote session relay protocol version. */
export const SESSION_RELAY_PROTOCOL_VERSION = 1;

/** Versioned frames exchanged by remote relay peers. */
export type SessionRelayFrame =
  | { readonly type: "hello"; readonly version: 1; readonly peerId: string }
  | { readonly type: "ready"; readonly version: 1 }
  | { readonly type: "relay"; readonly message: SessionRelay }
  | { readonly type: "ack"; readonly relayId: string }
  | { readonly type: "list"; readonly requestId: string }
  | { readonly type: "sessions"; readonly requestId: string; readonly sessions: readonly RelaySessionEntry[] }
  | { readonly type: "error"; readonly message: string; readonly relayId?: string; readonly requestId?: string };

/** Validate one relay frame received from a remote process. */
export function parseSessionRelayFrame(value: string): SessionRelayFrame {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    throw new Error("session relay frame must be an object with a type");
  }
  switch (parsed.type) {
    case "hello":
      if (parsed.version === 1 && nonEmptyString(parsed.peerId)) {
        return { type: "hello", version: 1, peerId: parsed.peerId };
      }
      break;
    case "ready":
      if (parsed.version === 1) return { type: "ready", version: 1 };
      break;
    case "relay":
      return { type: "relay", message: parseRelay(parsed.message) };
    case "ack":
      if (nonEmptyString(parsed.relayId)) return { type: "ack", relayId: parsed.relayId };
      break;
    case "list":
      if (nonEmptyString(parsed.requestId)) return { type: "list", requestId: parsed.requestId };
      break;
    case "sessions":
      if (nonEmptyString(parsed.requestId) && Array.isArray(parsed.sessions)) {
        return { type: "sessions", requestId: parsed.requestId, sessions: parsed.sessions.map(parseSessionEntry) };
      }
      break;
    case "error":
      if (typeof parsed.message === "string") {
        return {
          type: "error",
          message: parsed.message,
          ...(typeof parsed.relayId === "string" ? { relayId: parsed.relayId } : {}),
          ...(typeof parsed.requestId === "string" ? { requestId: parsed.requestId } : {}),
        };
      }
      break;
  }
  throw new Error(`invalid session relay ${parsed.type} frame`);
}

function parseRelay(value: unknown): SessionRelay {
  if (!isRecord(value)) throw new Error("session relay message must be an object");
  if (!nonEmptyString(value.relayId)) throw new Error("session relay id must not be empty");
  if (typeof value.content !== "string" || value.content.trim().length === 0) {
    throw new Error("session relay content must not be blank");
  }
  return {
    relayId: value.relayId,
    from: parseAddress(value.from, "from"),
    to: parseAddress(value.to, "to"),
    content: value.content,
  };
}

function parseAddress(value: unknown, name: string): SessionAddress {
  if (!isRecord(value) || !nonEmptyString(value.authorityId) || !nonEmptyString(value.sessionId)) {
    throw new Error(`session relay ${name} address is invalid`);
  }
  return { authorityId: value.authorityId, sessionId: value.sessionId };
}

function parseSessionEntry(value: unknown): RelaySessionEntry {
  if (
    !isRecord(value) ||
    !nonEmptyString(value.sessionId) ||
    typeof value.updatedAt !== "number" ||
    typeof value.running !== "boolean"
  ) throw new Error("session relay session entry is invalid");
  return {
    sessionId: value.sessionId,
    updatedAt: value.updatedAt,
    running: value.running,
    ...(typeof value.cwd === "string" ? { cwd: value.cwd } : {}),
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
