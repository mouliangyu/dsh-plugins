/**
 * Stable per-step skill catalog for DeepSeek Harness.
 *
 * Renders the skill catalog as a system-prompt section on every step —
 * fixed position, never dropped by compaction — and suppresses the built-in
 * digest-driven catalog message so the model sees exactly one authoritative
 * catalog with mandatory trigger rules.
 *
 * @module dsh-skill-stabilizer
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "skill-stabilizer";
export declare const inject: string[];
/** Model-facing skill catalog configuration. */
export interface Config {
    /** Maximum normalized description length rendered in the session catalog; minimum 3. */
    catalogDescriptionMaxLength?: number;
    /**
     * Maximum total byte size of the rendered catalog section. When the section
     * exceeds it, descriptions are shortened equally to fit; skill names are
     * never truncated or dropped. Defaults to `20000`.
     */
    catalogMaxBytes?: number;
    /**
     * Filter the built-in `dsh-tool-skill` catalog message out of every step so
     * only this plugin's system-prompt section presents the catalog. Defaults to
     * `true`. Set to `false` to keep the built-in message (two catalogs visible).
     */
    suppressBuiltinCatalog?: boolean;
}
/** Validate and default the model-facing skill catalog configuration. */
export declare const Config: z<Config>;
/**
 * Register the per-step skill catalog section and the built-in catalog
 * suppression. The catalog section is appended by the `system-prompt/assemble`
 * waterfall, which runs inside every step's prompt assembly, so the catalog is
 * re-rendered at a fixed position each step instead of sinking into message
 * history — the material stays visible regardless of how long the session
 * grows or what compaction hides.
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map