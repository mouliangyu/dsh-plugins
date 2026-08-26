/**
 * Transient composer notices: two tiny DOM surfaces the new capabilities
 * use for feedback. `createTransientNotice` flashes one line for a short
 * while (snippet saved/loaded, template errors, import results);
 * `createDraftHint` pins a small read-only line under the composer for the
 * reuse insight, hidden whenever the hint text is empty. Both own their DOM
 * and are fully removable — the wiring disposes them with the fiber.
 */
/** Handle of one transient notice instance. */
export interface TransientNotice {
    /** Flash a message near the composer for a short while. */
    show(text: string, kind?: 'info' | 'error'): void;
    dispose(): void;
}
/**
 * Create the transient notice surface. One node is reused across flashes;
 * the timer is cancelled on dispose.
 * @returns the handle, or undefined outside a document.
 */
export declare function createTransientNotice(): TransientNotice | undefined;
/** Handle of the draft hint (reuse insight line). */
export interface DraftHint {
    /** Update the hint text and position it under the composer ('' hides it). */
    set(text: string, anchor: HTMLElement): void;
    dispose(): void;
}
/**
 * Create the reuse-insight hint. Hidden until {@link DraftHint.set} receives
 * non-empty text; positioned under the anchor composer's bounding rect.
 * @returns the handle, or undefined outside a document.
 */
export declare function createDraftHint(): DraftHint | undefined;
//# sourceMappingURL=notice.d.ts.map