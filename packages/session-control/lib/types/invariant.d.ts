/** Package invariant companion for `dsh-session-control`. */
import type { Context } from "@deepseek-ai/cordis";
export declare const name = "session-control-invariant";
export declare const inject: string[];
/**
 * Register the package invariant companion.
 * @param ctx Host context carrying the invariant registry.
 * @returns Registration disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map