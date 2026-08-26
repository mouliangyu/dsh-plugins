/**
 * Visual-edge math: pure functions over measured line spans. The DOM
 * measurement itself lives in visual-mirror.ts; this module owns only the
 * span → caret-line reasoning so the decision logic stays unit-testable.
 */
/** One visual line as a half-open character range [start, end). */
export interface VisualLineSpan {
    readonly start: number;
    readonly end: number;
}
/**
 * The visual line index the caret belongs to. A caret sitting after a line
 * break (at the start of the next span) belongs to that next line; a caret
 * at or beyond the final span's end belongs to the last line.
 * @param spans - measured spans covering the draft, sorted, non-empty in practice.
 * @param caret - caret offset into the draft.
 * @returns 0-based line index; 0 when spans are empty.
 */
export declare function caretVisualLine(spans: readonly VisualLineSpan[], caret: number): number;
/**
 * ↑ takeover boundary: the caret is on the first visual line.
 * @param spans - measured spans for the draft.
 * @param caret - caret offset.
 */
export declare function upAtFirstVisualLine(spans: readonly VisualLineSpan[], caret: number): boolean;
/**
 * ↓ takeover boundary: the caret is on the last visual line.
 * @param spans - measured spans for the draft.
 * @param caret - caret offset.
 */
export declare function downAtLastVisualLine(spans: readonly VisualLineSpan[], caret: number): boolean;
//# sourceMappingURL=visual-edge.d.ts.map