/** Private WebSocket protocol owned by the remote authority transport. */
import type { RelaySessionEntry, SessionRelay } from "dsh-session-control/relay";
/** WebSocket route exposed by a relay-capable remote authority. */
export declare const SESSION_RELAY_PATH = "/api/dsh-remote/session-relay";
/** Current remote session relay protocol version. */
export declare const SESSION_RELAY_PROTOCOL_VERSION = 1;
/** Versioned frames exchanged by remote relay peers. */
export type SessionRelayFrame = {
    readonly type: "hello";
    readonly version: 1;
    readonly peerId: string;
} | {
    readonly type: "ready";
    readonly version: 1;
} | {
    readonly type: "relay";
    readonly message: SessionRelay;
} | {
    readonly type: "ack";
    readonly relayId: string;
} | {
    readonly type: "list";
    readonly requestId: string;
} | {
    readonly type: "sessions";
    readonly requestId: string;
    readonly sessions: readonly RelaySessionEntry[];
} | {
    readonly type: "error";
    readonly message: string;
    readonly relayId?: string;
    readonly requestId?: string;
};
/** Validate one relay frame received from a remote process. */
export declare function parseSessionRelayFrame(value: string): SessionRelayFrame;
//# sourceMappingURL=relay-protocol.d.ts.map