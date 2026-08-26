/**
 * Bounded persisted history cache: the plugin's on-disk (browser-local)
 * companion to the live session projection. Entries are appended when new
 * user messages commit, stored newest-last under one versioned JSON payload,
 * deduplicated by exact text, and trimmed to a cap. A corrupt or foreign
 * payload resets to empty — recall never depends on this store.
 */
/** Minimal storage face (window.localStorage is structural). */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
/** LocalStorage key of the persisted history payload. */
export declare const STORE_KEY = "dsh.composer-history.v1";
/**
 * Read the persisted entries. Returns [] for an absent, corrupt, foreign, or
 * unreadable payload — persistence is a convenience, never a failure mode.
 * @param storage - readable storage.
 * @param key - storage key.
 * @returns stored entries, oldest first.
 */
export declare function loadEntries(storage: StorageLike, key: string): string[];
/**
 * Persist entries (replace the payload wholesale).
 * @param storage - writable storage.
 * @param key - storage key.
 * @param entries - entries to store, oldest first.
 */
export declare function saveEntries(storage: StorageLike, key: string, entries: readonly string[]): void;
/**
 * Append new entries to the persisted store: exact-text dedupe against the
 * stored entries (new occurrences keep their stored position), then trim to
 * the newest `cap` (0 = unlimited) and write once. Nothing is written when
 * nothing was added.
 * @param storage - readable and writable storage.
 * @param key - storage key.
 * @param texts - candidate entries in oldest-first order.
 * @param cap - maximum stored entries, newest kept; 0 means unlimited.
 * @returns the entries actually added, in order.
 */
export declare function appendEntries(storage: StorageLike, key: string, texts: readonly string[], cap: number): string[];
/**
 * Wrap a DOM Storage in never-throw accessors: a disabled or full storage
 * (private mode, quota) degrades persistence to session lifetime instead of
 * breaking key handling.
 * @param storage - the ambient localStorage, or undefined outside a browser.
 * @returns the safe face, or undefined when no storage exists.
 */
export declare function safeStorage(storage: Storage | undefined): StorageLike | undefined;
//# sourceMappingURL=history-store.d.ts.map