/**
 * DOM mirror measurement for edgeMode='visual': a hidden div replicating the
 * textarea's width/font/line-height/padding/white-space pre-wrap geometry
 * exposes the real wrapped line boxes, and a Range over the mirror text
 * yields one client rect per visual line. Character offsets of the wrap
 * boundaries are recovered by binary-searching rect tops, which produces
 * the {@link VisualLineSpan} list consumed by the pure edge predicates.
 *
 * The span math is a pure seam over an injected `topAt(offset)` line-top
 * probe ({@link nextWrapOffsetBy}/{@link computeSpans}), so the binary search
 * is unit-testable without a layout engine; the Range glue stays thin. The
 * measurer also memoizes its last measurement per (composer, draft, width),
 * because every key press re-measures while browsing.
 */
import type { VisualLineSpan } from './visual-edge.js';
/** Hidden measurement mirror bound to one plugin lifetime. */
export interface MirrorMeasurer {
    /**
     * Measure the visual line spans of a draft for one composer.
     * @param composer - the textarea whose geometry the mirror copies.
     * @param draft - the text to lay out.
     * @returns spans in character order, or undefined when no measurement is possible.
     */
    spans(composer: HTMLTextAreaElement, draft: string): VisualLineSpan[] | undefined;
    /** Remove the mirror node. */
    dispose(): void;
}
/** A probe returning the top of the visual line holding the character AT an offset. */
export type TopAt = (offset: number) => number;
/**
 * Find the first character index after `start` that opens a new visual
 * line, by binary-searching the index whose line top exceeds the line top
 * at `start`. Pure over the injected top probe; the probe is only ever
 * asked about offsets inside [start, length), so the caller needs no
 * sentinel semantics.
 * @param topAt - line-top probe.
 * @param start - first character of the current visual line.
 * @param length - draft length.
 * @returns the wrap offset (first index of the next line), or undefined
 *   when no later line exists.
 */
export declare function nextWrapOffsetBy(topAt: TopAt, start: number, length: number): number | undefined;
/**
 * Recover the visual-line span list from a line-top probe: one span per
 * visual line, each boundary found with {@link nextWrapOffsetBy}. Pure over
 * the injected probe; the DOM layer supplies it from Range rects.
 * @param topAt - line-top probe over [0, draftLength].
 * @param draftLength - character count of the laid-out draft.
 * @param visualLines - rect count of the full range (the probe must agree).
 * @returns spans covering the draft, or undefined when the probe cannot
 *   resolve the layout.
 */
export declare function computeSpans(topAt: TopAt, draftLength: number, visualLines: number): VisualLineSpan[] | undefined;
/**
 * Create the hidden mirror and its span measurer. The mirror is appended to
 * document.body and removed by {@link MirrorMeasurer.dispose}.
 * @returns the measurer, or undefined outside a document.
 */
export declare function createMirrorMeasurer(): MirrorMeasurer | undefined;
//# sourceMappingURL=visual-mirror.d.ts.map