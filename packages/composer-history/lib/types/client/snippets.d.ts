/**
 * Cross-session snippet library: named command texts saved from the
 * composer (`/save <name>`), loaded back by name (`/load <name>`) or picked
 * from the reverse-search overlay, persisted browser-locally and scoped
 * per workspace. Everything here is pure over an injected storage face —
 * the DOM stays in the owning wiring, so the whole library is unit-testable
 * without a browser. A corrupt or foreign payload degrades to empty, never
 * to a failure.
 */
/** One stored snippet. */
export interface SnippetRecord {
    /** Unique snippet name (kebab-case), 1..64 chars. */
    readonly name: string;
    /** The snippet text (non-empty after trim). */
    readonly text: string;
    /** Advisory tags, ≤8, each ≤32 chars, trimmed and deduped. */
    readonly tags: readonly string[];
    /** 'global' or a workspace key (the snippet only loads inside that workspace). */
    readonly scope: string;
    /** Epoch ms of creation. */
    readonly createdAt: number;
    /** Epoch ms of the last save. */
    readonly updatedAt: number;
    /** How many times the snippet was loaded. */
    readonly useCount: number;
    /** Epoch ms of the last load, or 0. */
    readonly lastUsedAt: number;
}
/** Storage face (the safeStorage wrapper from history-store satisfies it). */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
/** Parsed `/save` / `/load` command. */
export interface SnippetCommand {
    readonly verb: 'save' | 'load';
    readonly name: string;
    /** Tags declared with --tag=a,b (save only). */
    readonly tags: readonly string[];
}
/** LocalStorage key of the snippet payload. */
export declare const SNIPPET_STORE_KEY = "dsh.composer-history.snippets.v1";
/** Hard caps (protocol constants, not tunables). */
export declare const MAX_SNIPPET_TAGS = 8;
export declare const MAX_TAG_LENGTH = 32;
/**
 * Parse a `/save <name>` or `/load <name>` command from a composer draft.
 * Only a draft whose first line is exactly the command qualifies; tags are
 * optional and only meaningful for save.
 * @param draft - the full composer draft.
 * @returns the parsed command, or undefined when the draft is not a snippet command.
 */
export declare function parseSnippetCommand(draft: string): SnippetCommand | undefined;
/**
 * The text a `/save <name>` command captures: the draft with the command's
 * first line removed, trimmed. Empty when there is nothing to save.
 * @param draft - the full composer draft.
 * @returns the snippet text ('' when nothing remains).
 */
export declare function saveCommandText(draft: string): string;
/**
 * Validate a snippet before persistence: name grammar, non-empty text,
 * tag caps. Throws a descriptive Error on the first violation (fail-loud).
 * @param name - snippet name.
 * @param text - snippet text.
 * @param tags - advisory tags.
 */
export declare function validateSnippet(name: string, text: string, tags: readonly string[]): void;
/**
 * Read the stored snippets, oldest first. Returns [] for an absent, corrupt,
 * or foreign payload — the library is a convenience, never a failure mode.
 * @param storage - readable storage.
 * @returns the stored snippets.
 */
export declare function loadSnippets(storage: StorageLike): SnippetRecord[];
/**
 * Save or replace one snippet: same name = replace (fresh updatedAt,
 * preserved use counters); new name = append. Trimmed to the newest `cap`
 * (0 = unlimited) and written once.
 * @param storage - readable and writable storage.
 * @param snippet - the snippet to persist.
 * @param cap - maximum stored snippets; 0 means unlimited.
 * @returns the stored record.
 */
export declare function upsertSnippet(storage: StorageLike, snippet: Omit<SnippetRecord, 'createdAt' | 'updatedAt' | 'useCount' | 'lastUsedAt'>, cap: number): SnippetRecord;
/**
 * Record one snippet load: use counters and last-used time update in place.
 * @param storage - readable and writable storage.
 * @param name - the loaded snippet name.
 * @returns the updated record, or undefined when the snippet does not exist.
 */
export declare function noteSnippetUse(storage: StorageLike, name: string): SnippetRecord | undefined;
//# sourceMappingURL=snippets.d.ts.map