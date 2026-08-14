/**
 * Model-facing session orchestration tools for DeepSeek Harness.
 *
 * Existing sessions can be managed globally by default. Deployments can
 * restore a caller-workspace authorization boundary through configuration.
 * The plugin does not create remote workers; install a subagent provider
 * separately when a child must run on another host.
 */
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
/** Cordis plugin name used by Loader diagnostics. */
export declare const name = "session_control";
/** Services required by the session-manager tools. */
export declare const inject: string[];
/** Deployment-owned bounds for autonomous session orchestration. */
export interface Config {
    /** Manage sessions across every workspace. Defaults to true. */
    allowGlobalAccess?: boolean;
    /** Whether the destructive archive tool is exposed. Defaults to false. */
    allowArchive?: boolean;
    /** Maximum concurrently resident sessions owned by this plugin. Defaults to 12. */
    maxManagedSessions?: number;
}
export declare const Config: z<Config>;
/** Register create, list, send, stop, and optional archive tools. */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map