/** Local Web Host plugin for SSH-backed remote project management. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { RemoteConnectionConfig } from './local-contract.ts';
export type * from './local-contract.ts';
export declare const name = "dsh-remote-local";
export declare const inject: string[];
/** Local plugin composition defaults. */
export interface LocalConfig {
    connections?: RemoteConnectionConfig[];
    /** Exact official DSH release installed into the private remote runtime. */
    remoteDshPackage?: string;
    /** OpenSSH connection timeout applied to bridges and bootstrap actions. */
    sshConnectTimeoutSeconds?: number;
    /** Maximum duration of remote package installation and daemon startup. */
    bootstrapTimeoutMs?: number;
}
export declare const Config: z<LocalConfig>;
/** Mount the local connection registry and browser endpoints. */
export declare function apply(ctx: Context, config?: LocalConfig): void;
//# sourceMappingURL=local.d.ts.map