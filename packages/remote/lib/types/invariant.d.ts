/** Package-owned invariant companion for the remote host. @module dsh-remote/invariant */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "remote-invariant";
export declare const inject: string[];
/** Register the package ownership companion. @param ctx - context carrying invariant registration. @returns the disposer. */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map