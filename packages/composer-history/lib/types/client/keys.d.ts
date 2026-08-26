/**
 * Key-spec parsing and matching: the tunable keybindings of the plugin.
 * Arrow/Escape keys are plain `KeyboardEvent.key` names; search chords are
 * `Modifier+Key` specs ('Ctrl+R'). Both are Config strings — malformed specs
 * throw here, so a bad cordis.yml/settings value fails the plugin fiber
 * loudly at load instead of silently disabling a key.
 */
/** One parsed search chord: exact modifier set plus the key name. */
export interface KeyChord {
    readonly key: string;
    readonly ctrl: boolean;
    readonly alt: boolean;
    readonly meta: boolean;
    readonly shift: boolean;
}
/** Keyboard facts a chord is matched against (KeyboardEvent is structural). */
export interface ChordKeyEvent {
    readonly key: string;
    readonly ctrlKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;
}
/**
 * Parse one chord spec like 'Ctrl+R' or 'Ctrl+Shift+Up'.
 * @param spec - config string.
 * @returns the parsed chord.
 * @throws when the spec is empty, names an unknown modifier, repeats a
 *   modifier, or has no trailing key name.
 */
export declare function parseChord(spec: string): KeyChord;
/**
 * Whether a keyboard event matches a parsed chord exactly: every modifier
 * the chord declares is held, no undeclared modifier is held, and the key
 * name matches case-insensitively.
 * @param event - keyboard facts.
 * @param chord - parsed chord.
 */
export declare function chordMatches(event: ChordKeyEvent, chord: KeyChord): boolean;
//# sourceMappingURL=keys.d.ts.map