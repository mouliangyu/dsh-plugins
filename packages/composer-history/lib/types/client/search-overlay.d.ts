/**
 * Reverse-search overlay: a minimal DOM panel (query input + match list)
 * opened under the composer for terminal-style Ctrl+R recall. Owns its DOM,
 * styles, and listeners; keyboard events targeting the overlay pass the
 * window-capture interception untouched (the composerOf gate rejects them).
 * Pick (Enter / click) hands the chosen text to the caller; Escape or an
 * outside press cancels. All filter and highlight decisions delegate to
 * search.ts; the panel placement is the pure placePanel clamp (below the
 * composer, flipped above on downward overflow, horizontally clamped into
 * the viewport).
 *
 * Entries are either plain strings (history, backward compatible) or
 * structured {@link SearchEntry} values carrying a provenance badge
 * (compacted summaries are highlighted amber, snippets and templates show
 * their name) and optional footer actions (template import/export).
 */
import { type SearchEntry } from './search.js';
/** Callbacks the owning wiring satisfies. */
export interface SearchOverlayDeps {
    /** The chosen entry was confirmed (provenance passed through for templates/snippets). */
    onPick(text: string, source?: SearchEntry['source'], label?: string): void;
    /** The search was dismissed without a pick. */
    onCancel(): void;
}
/** One footer action (rendered as a small button row under the list). */
export interface OverlayAction {
    readonly label: string;
    onClick(): void;
}
/** Overlay handle owned by one plugin install. */
export interface SearchOverlay {
    /** Whether the panel is currently shown. */
    isOpen(): boolean;
    /** Show the panel under the composer and list the matches for ''. */
    open(anchor: HTMLElement, entries: (string | SearchEntry)[], caseSensitive: boolean, actions?: OverlayAction[]): void;
    /** Remove the panel node and every listener. */
    dispose(): void;
}
/** Viewport-relative anchor rectangle (the composer's bounding rect). */
export interface PanelAnchorRect {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}
/** Viewport size the panel is placed inside. */
export interface PanelViewport {
    readonly width: number;
    readonly height: number;
}
/** Resolved fixed-position placement of the panel. */
export interface PanelPlacement {
    readonly left: number;
    readonly top: number;
    readonly width: number;
}
/**
 * Resolve the panel's fixed-position placement for one composer anchor:
 * at least {@link PANEL_MIN_WIDTH} wide (never wider than the viewport
 * minus margins), horizontally clamped into the viewport, below the
 * composer by default and above it when the panel would overflow downward.
 * Pure over the injected rects so the clamp math is unit-testable.
 * @param anchor - the composer's viewport-relative bounding rect.
 * @param viewport - window inner size.
 * @returns rounded pixel placement.
 */
export declare function placePanel(anchor: PanelAnchorRect, viewport: PanelViewport): PanelPlacement;
/**
 * Create the overlay (injecting its shared stylesheet once per document).
 * @param deps - pick/cancel callbacks.
 * @returns the handle, or undefined outside a document.
 */
export declare function createSearchOverlay(deps: SearchOverlayDeps): SearchOverlay | undefined;
//# sourceMappingURL=search-overlay.d.ts.map