/**
 * Compaction notice: a transient, viewport-anchored snackbar announcing that
 * the harness just slid the context window — the Claude Code / Codex
 * "Auto-compacting conversation…" moment. Plain DOM, no React, one injected
 * stylesheet per document. Shown for a bounded time, dismissed on any
 * click; the optional "Compact now" action hands the configured slash
 * command to the caller (which fills the composer — the plugin never sends).
 */
import type { CompactionNoticeInfo } from './compaction-watch.js';
/** Callbacks the owning wiring satisfies. */
export interface CompactionNoticeDeps {
    /** Fill the configured compact command into the composer ('' = hidden action). */
    readonly compactCommandText: string;
    /** The "Compact now" action was pressed. */
    onCompactNow(): void;
}
/** Toast handle owned by one plugin install. */
export interface CompactionNotice {
    /** Show (or refresh) the notice for one landed checkpoint. */
    show(info: CompactionNoticeInfo): void;
    /** Cancel the auto-dismiss timer and remove the node. */
    dispose(): void;
}
/**
 * Create the notice (injecting its stylesheet once per document).
 * @param deps - compact-now wiring plus the command label.
 * @returns the handle, or undefined outside a document.
 */
export declare function createCompactionNotice(deps: CompactionNoticeDeps): CompactionNotice | undefined;
//# sourceMappingURL=compaction-notice.d.ts.map