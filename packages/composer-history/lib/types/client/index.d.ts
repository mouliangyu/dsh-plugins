/**
 * dsh-composer-history, browser half: window-capture keyboard interception
 * that layers terminal-style draft recall over the composer. All reads go
 * through the session services (current session snapshot for history, the
 * input machine facade for draft/phase and the single setDraft write path);
 * the slash-menu gate reads the inputTriggers service, asserted to its
 * exported class type — the sanctioned cross-package pattern for service
 * instances — and falls back to the trigger-token heuristic when the
 * service is absent.
 *
 * Effective options resolve from three layers: the boot config (none today),
 * the settings scope (the host namespace carrying the cordis.yml `base` plus
 * any user overrides), and the schema defaults. The scope arrives
 * asynchronously; the wiring reinstalls on every committed change.
 * Sent messages are appended to a bounded browser-local history store so
 * recall survives reloads and reaches across sessions. Compaction
 * checkpoints (the harness's sliding-context summaries) join recall and
 * search as prefixed entries, and a transient notice announces each
 * checkpoint that lands while the page is open.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ComposerHistoryConfig } from './config.js';
export { Config, resolveConfig } from './config.js';
export type { ComposerHistoryConfig } from './config.js';
export type { RecallEffect, RecallOptions, RecallState } from './recall.js';
/** Plugin name: matches the package name, the graph row id, and the bundle id. */
export declare const name = "dsh-composer-history";
/** Services the interception reads; activation waits on them. */
export declare const inject: string[];
/**
 * Browser plugin body: resolve the effective options, wire the interception
 * host over the session/input/trigger services, keep the persisted history
 * store in sync with the current session's commits, and register the
 * window-capture listeners as one effect. The settings scope is observed;
 * every committed option change tears the wiring down and reinstalls it.
 * @param ctx - client root context.
 * @param config - partial config (browser boot passes none today); resolved
 *   against the schema so defaults apply and invalid values throw loudly.
 */
export declare function apply(ctx: ClientContext, config?: Partial<ComposerHistoryConfig>): void;
//# sourceMappingURL=index.d.ts.map