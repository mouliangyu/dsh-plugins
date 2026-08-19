/** Cross-authority session message routing independent of its transport. */
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { Context } from "@deepseek-ai/cordis";
/** Authority name used for sessions owned by the current DSH process. */
export declare const LOCAL_AUTHORITY = "local";
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
export declare function parseSessionAddress(value: string): SessionAddress;
/** Format an address for the model-facing session tools. */
export declare function formatSessionAddress(address: SessionAddress): string;
/** Create one uniquely identified relay. */
export declare function createSessionRelay(fromSessionId: string, to: SessionAddress, content: string): SessionRelay;
/** Encode durable relay attribution into the official prompt correlation id. */
export declare function relayRpcId(message: SessionRelay): string;
/** Recover relay attribution from an official prompt correlation id. */
export declare function parseRelayRpcId(value: string): {
    relayId: string;
    from: SessionAddress;
} | undefined;
/** Build the process-local session relay service. */
export declare function createSessionRelayService(ctx: Context): SessionRelayService;
/** Find the most recent external or local relay sender in an Agent log. */
export declare function latestRelayAddress(agent: Agent): SessionAddress;
//# sourceMappingURL=relay.d.ts.map