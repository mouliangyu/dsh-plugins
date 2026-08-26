/**
 * Runtime-node → recall-view mapping: the pure seam between the client
 * conversation snapshot ({@link ConversationNode}) and the extractor's
 * {@link HistoryNodeView}. Lifted out of the wiring layer so the mapping is
 * unit-testable with structural fakes and stays free of cordis/DOM.
 *
 * Sliding-context integration: `compaction` checkpoint markers (the
 * harness's Claude Code / Codex-style auto-compact summaries) project to a
 * single prefixed text entry, so the summarized history stays reachable
 * from ↑ recall and Ctrl+R search after the model surface has slid past it.
 */
import type { ConversationNode } from '@deepseek-ai/dsh-client-runtime/client';
import type { HistoryNodeView } from './recall.js';
/** Prefix marking an entry that came from a compaction checkpoint, not the composer. */
export declare const COMPACTED_PREFIX = "[compacted] ";
/**
 * Project one conversation node onto a recall view.
 * @param node - one snapshot node (any kind).
 * @returns the view, or undefined when the node carries no recallable text
 *   (non-text kinds, compaction markers whose summary fell outside the
 *   window, blank content).
 */
export declare function viewOfNode(node: ConversationNode): HistoryNodeView | undefined;
/**
 * Project a snapshot's nodes onto recall views, keeping source order.
 * @param nodes - conversation nodes in seq order.
 * @returns views for every node that carries recallable text.
 */
export declare function viewOfNodes(nodes: readonly ConversationNode[]): HistoryNodeView[];
//# sourceMappingURL=node-views.d.ts.map