/** Incoming remote-authority relay transport for a DSH Web process. */
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "dsh_remote_relay_channel";
/** Services required to expose the relay transport. */
export declare const inject: string[];
/** Relay transport timeout configuration. */
export interface Config {
    /** Handshake and request timeout in seconds. Defaults to 30. */
    requestTimeoutSeconds?: number;
}
export declare const Config: z<Config>;
/** Expose the session relay service through the dsh-remote WebSocket protocol. */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=relay-channel.d.ts.map