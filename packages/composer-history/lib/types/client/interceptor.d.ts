/**
 * Browser wiring core: turns the pure {@link DraftRecall} machine into the
 * window-capture keyboard behavior. Everything platform-specific arrives
 * through the injected {@link ComposerHistoryHost}, so the full takeover
 * semantics (preventDefault/stopPropagation discipline, divergence on edit,
 * session-switch reset, search chord, key remapping) are testable under
 * jsdom with fakes.
 *
 * Contract: an event is only prevented once the machine produced a non-pass
 * effect; every pass path leaves the event untouched. After a takeover the
 * caret is moved to the end of the filled text on the next animation frame
 * (requestAnimationFrame + setSelectionRange, pending frames cancelled on
 * reschedule and dispose), and the draft write always goes through the
 * host's setDraft (the input machine's single write path).
 */
import { type HistoryNodeView, type RecallState } from './recall.js';
import { type VisualLineSpan } from './visual-edge.js';
import type { ComposerHistoryConfig } from './config.js';
/** The input-machine slice the interceptor reads (phase gates interception). */
export interface ComposerInputView {
    readonly draft: string;
    readonly phase: string;
}
/**
 * Platform seams the plugin body satisfies. All methods run synchronously;
 * event-handler reads of live snapshots are the sanctioned pattern.
 */
export interface ComposerHistoryHost {
    /** The composer textarea behind an event target, or undefined outside the composer. */
    composerOf(target: EventTarget | null): HTMLTextAreaElement | undefined;
    /** Stable identity of the session the composer belongs to (resets on switch). */
    sessionKey(composer: HTMLTextAreaElement): string | undefined;
    /** Live input machine state of the composer's session. */
    inputState(composer: HTMLTextAreaElement): ComposerInputView | undefined;
    /** Session nodes for the fresh history extraction (called per key press). */
    history(composer: HTMLTextAreaElement): readonly HistoryNodeView[];
    /** Already-extracted entries from beyond the current session (persisted, workspace). */
    supplementalHistory?(composer: HTMLTextAreaElement): readonly string[];
    /** A picker owning the arrow keys is open (slash menu, command popup, token fallback). */
    menuOpen(composer: HTMLTextAreaElement): boolean;
    /** Single programmatic draft write path. */
    setDraft(composer: HTMLTextAreaElement, text: string): void;
    /** Open the reverse-search overlay for the merged history (search chord takeover). */
    openSearch(composer: HTMLTextAreaElement, history: readonly string[]): void;
    /** Measured visual line spans for edgeMode='visual'; absent in logical mode. */
    visualSpans?(composer: HTMLTextAreaElement, draft: string): readonly VisualLineSpan[] | undefined;
}
/** Handle owned by one plugin apply: the window-capture listeners plus introspection. */
export interface ComposerHistoryHandle {
    keydown(event: KeyboardEvent): void;
    input(event: Event): void;
    state(): RecallState;
    reset(): void;
    /** Write a text into the draft and move the caret to its end (search picks). */
    fill(composer: HTMLTextAreaElement, text: string): void;
    /** Cancel pending caret frames and leave the machine idle (owner teardown). */
    dispose(): void;
}
/**
 * Build the interception handle over a host and the resolved options.
 * Search chord specs are parsed here: a malformed spec throws, failing the
 * browser fiber loudly at load.
 * @param host - platform seams.
 * @param config - resolved tunables.
 * @returns the handle; wire it to window capture listeners and dispose with
 *   the owning fiber (the handle owns no external resources itself).
 */
export declare function createComposerHistory(host: ComposerHistoryHost, config: ComposerHistoryConfig): ComposerHistoryHandle;
//# sourceMappingURL=interceptor.d.ts.map