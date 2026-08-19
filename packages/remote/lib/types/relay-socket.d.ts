/** Connected WebSocket adapter for the transport-neutral session relay provider. */
import { WebSocket } from "ws";
import type { RelaySessionEntry, SessionRelay, SessionRelayProvider } from "dsh-session-control/relay";
/** Operations supplied by the DSH process attached to one socket. */
export interface SessionRelaySocketHandlers {
    receive(message: SessionRelay): Promise<void>;
    listSessions(): Promise<readonly RelaySessionEntry[]>;
    closed?(error: Error): void;
}
/** One connected remote peer with request acknowledgement and session listing. */
export declare class SessionRelaySocketProvider implements SessionRelayProvider {
    readonly authorityId: string;
    private readonly socket;
    private readonly handlers;
    private readonly requestTimeoutMs;
    private readonly relayRequests;
    private readonly listRequests;
    private closed;
    constructor(authorityId: string, socket: WebSocket, handlers: SessionRelaySocketHandlers, requestTimeoutMs: number);
    send(message: SessionRelay): Promise<void>;
    listSessions(): Promise<readonly RelaySessionEntry[]>;
    close(): void;
    private handle;
    private pending;
    private settle;
    private reject;
    private write;
    private fail;
}
//# sourceMappingURL=relay-socket.d.ts.map