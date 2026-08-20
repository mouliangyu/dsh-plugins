/** Package-owned invariant companion for the stable skill catalog. @module dsh-skill-stabilizer/invariant */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "skill-stabilizer-invariant";
export declare const inject: string[];
/** Register the package ownership companion. @param ctx - context carrying invariant registration. @returns the disposer. */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map