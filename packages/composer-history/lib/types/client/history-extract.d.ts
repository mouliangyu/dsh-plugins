/**
 * Extraction memo for the wiring layer: conversation snapshots are immutable
 * (stable array reference until the next change), so repeated per-keypress
 * extraction can reuse the last result keyed by the nodes array reference.
 * Two extraction shapes coexist per source — unlimited and history-capped —
 * and each is cached separately so the persistence path (unlimited) and the
 * recall path (capped) never answer each other's slot.
 */
import { type HistoryNodeView } from './recall.js';
/** Cached extraction over one snapshot source. */
export declare class HistoryExtractor<TNodes extends object> {
    private readonly kinds;
    private readonly max;
    private readonly convert;
    private readonly slots;
    /**
     * @param kinds - node kinds admitted (fixed per install).
     * @param max - the install's history cap (fixed per install).
     * @param convert - maps the raw snapshot nodes to projected views (runs
     *   only on cache misses).
     */
    constructor(kinds: readonly string[], max: number, convert: (nodes: TNodes) => readonly HistoryNodeView[]);
    /**
     * Extract the entries of one nodes snapshot, memoized by its reference.
     * @param nodes - the snapshot's nodes array.
     * @param max - this call's cap; 0 means unlimited (defaults to the
     *   install's cap).
     * @returns non-blank entries, oldest first.
     */
    extract(nodes: TNodes, max?: number): string[];
}
//# sourceMappingURL=history-extract.d.ts.map