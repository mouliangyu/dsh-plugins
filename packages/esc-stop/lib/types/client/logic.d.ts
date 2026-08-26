/**
 * Pure escape-to-stop decision helper.
 *
 * Kept free of DOM and React so the guard rules are unit-testable and the
 * browser bundle stays dependency-light.
 */
export interface EscapeStopDecision {
    /** The key that was pressed. */
    readonly key: string;
    /** IME composition in progress — never steal Escape from the IME. */
    readonly composing: boolean;
    /** Alt held — never hijack chords. */
    readonly alt: boolean;
    /** Ctrl held — never hijack chords. */
    readonly ctrl: boolean;
    /** Meta held — never hijack chords. */
    readonly meta: boolean;
    /** A handler already consumed the key (popup/menu/overlay closed it). */
    readonly defaultPrevented: boolean;
    /** The scoped session's agent turn is in flight. */
    readonly running: boolean;
    /** The composer exposes an enabled Stop button right now. */
    readonly stopAvailable: boolean;
    /** An approval/question panel is pending — leave Escape to it. */
    readonly approvalPending: boolean;
}
export declare function shouldStopEscape(input: EscapeStopDecision): boolean;
//# sourceMappingURL=logic.d.ts.map