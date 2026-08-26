/**
 * Reuse insights: browser-local statistics over which prompt texts the
 * user keeps sending. Every committed user message (and every snippet
 * load) lands one usage record keyed by exact text; the composer then
 * shows a lightweight hint — "this prompt was used M times across N
 * sessions". Nothing ever leaves the browser: the store is localStorage,
 * there is no network path, and the stats carry no content beyond the
 * deduped texts themselves.
 */
/** Storage face (safeStorage satisfies it). */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
/** One usage record. */
export interface UsageRecord {
    /** The exact prompt text the record is keyed on. */
    readonly text: string;
    /** Session ids the text was used in (most recent first, capped). */
    readonly sessions: readonly string[];
    /** Total use count. */
    readonly uses: number;
    /** Epoch ms of the last use. */
    readonly lastUsedAt: number;
}
/** LocalStorage key of the usage payload. */
export declare const INSIGHT_STORE_KEY = "dsh.composer-history.insights.v1";
/** Hard caps (protocol constants, not tunables). */
export declare const MAX_INSIGHT_RECORDS = 500;
export declare const MAX_SESSIONS_PER_RECORD = 50;
/** Minimum text length considered a reusable prompt (one-line noise excluded). */
export declare const MIN_REUSABLE_LENGTH = 3;
/**
 * Read the stored usage records. Returns [] for an absent, corrupt, or
 * foreign payload — insights are a convenience, never a failure mode.
 * @param storage - readable storage.
 * @returns the stored records.
 */
export declare function loadUsage(storage: StorageLike): UsageRecord[];
/**
 * Record one use of a prompt text in one session. Short texts are ignored
 * (noise filter); the record list is capped at {@link MAX_INSIGHT_RECORDS}
 * by last-used recency.
 * @param storage - readable and writable storage.
 * @param text - the used prompt text.
 * @param sessionId - the session it was used in ('' when unknown).
 * @returns the updated record, or undefined when the text was filtered out.
 */
export declare function noteUsage(storage: StorageLike, text: string, sessionId: string): UsageRecord | undefined;
/**
 * The reuse hint for a draft's first line: the usage record whose text the
 * draft exactly matches. Undefined when there is no match or the draft is
 * below the reusable length.
 * @param storage - readable storage.
 * @param draft - the current composer draft.
 * @returns the matching record, or undefined.
 */
export declare function hintFor(storage: StorageLike, draft: string): UsageRecord | undefined;
/**
 * Render the hint line for a record: session and use counts, bilingual,
 * kept to one short line (it overlays the composer, never the message).
 * @param record - the usage record.
 * @returns the hint text.
 */
export declare function hintText(record: UsageRecord): string;
//# sourceMappingURL=insights.d.ts.map