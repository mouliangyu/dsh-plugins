/** Host-side WebSocket provider for the session-control relay service. */
import { type RelaySessionEntry, type SessionRelay, type SessionRelayProvider } from "dsh-session-control/relay";
import type { RemoteApiForward } from "./transparent.js";
/** Options for one forwarded relay connection. */
export interface RemoteSessionRelayOptions {
    readonly authorityId: string;
    readonly peerId: string;
    readonly forward: RemoteApiForward;
    readonly requestTimeoutMs: number;
    receive(message: SessionRelay): Promise<void>;
    listSessions?: () => Promise<readonly RelaySessionEntry[]>;
    closed?(error: Error): void;
}
/** One Host-side remote authority relay provider. */
export declare class RemoteSessionRelayProvider implements SessionRelayProvider {
    readonly authorityId: string;
    private readonly peerId;
    private readonly socketProvider;
    private readonly socket;
    private constructor();
    /** Open and handshake a provider through an existing SSH local forward. */
    static connect(options: RemoteSessionRelayOptions): Promise<RemoteSessionRelayProvider>;
    send(message: SessionRelay): Promise<void>;
    listSessions(): Promise<readonly RelaySessionEntry[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=session-relay.d.ts.map