/**
 * Prompt templates with `{{variable}}` placeholders: a browser-local
 * template library filled at insertion time from the built-in session
 * variables (workspace, session, draft) plus the user's own values. The
 * library exports to and imports from JSON only on an explicit user
 * action — the plugin never writes files on its own. All logic is pure:
 * parse/fill/round-trip are unit-testable without a browser.
 */
/** One stored template. */
export interface TemplateRecord {
    /** Unique template name (kebab-case), 1..64 chars. */
    readonly name: string;
    /** The template text; `{{var}}` placeholders are filled at insertion. */
    readonly text: string;
    /** One-line purpose note (optional). */
    readonly description: string;
    /** Epoch ms of the last save. */
    readonly updatedAt: number;
}
/** Storage face (safeStorage satisfies it). */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
/** LocalStorage key of the template payload. */
export declare const TEMPLATE_STORE_KEY = "dsh.composer-history.templates.v1";
/** Hard caps (protocol constants, not tunables). */
export declare const MAX_TEMPLATES = 500;
/**
 * Extract the `{{variable}}` names from a template, in first-occurrence
 * order. Duplicate occurrences collapse to one name.
 * @param text - template text.
 * @returns the variable names.
 */
export declare function templateVariables(text: string): string[];
/**
 * Fill a template from the variable values. Unknown variables fail loudly
 * with the full missing list — a half-filled prompt is worse than an error.
 * @param text - template text.
 * @param values - variable values by name.
 * @returns the filled text.
 * @throws when a variable has no value.
 */
export declare function fillTemplate(text: string, values: Readonly<Record<string, string>>): string;
/**
 * Validate a template before persistence. Throws on the first violation.
 * @param name - template name.
 * @param text - template text.
 */
export declare function validateTemplate(name: string, text: string): void;
/**
 * Read the stored templates. Returns [] for an absent, corrupt, or foreign
 * payload — the library is a convenience, never a failure mode.
 * @param storage - readable storage.
 * @returns the stored templates, oldest first.
 */
export declare function loadTemplates(storage: StorageLike): TemplateRecord[];
/**
 * Save or replace one template (same name replaces, fresh updatedAt).
 * @param storage - readable and writable storage.
 * @param template - name/text/description.
 * @returns the stored record.
 */
export declare function upsertTemplate(storage: StorageLike, template: {
    readonly name: string;
    readonly text: string;
    readonly description?: string;
}): TemplateRecord;
/**
 * Serialize the template library to an export JSON document (an explicit
 * user action in the UI; this function never writes anywhere).
 * @param templates - the library.
 * @returns the export document as a JSON string.
 */
export declare function templatesToJson(templates: readonly TemplateRecord[]): string;
/**
 * Parse and validate an import JSON document. Unknown schema markers and
 * malformed templates throw with a descriptive message (fail-loud), and
 * the imported list is capped at {@link MAX_TEMPLATES}.
 * @param json - the import document.
 * @returns the validated templates, oldest first.
 * @throws on a foreign schema or malformed template.
 */
export declare function templatesFromJson(json: string): TemplateRecord[];
/**
 * Merge imported templates into the library (same name = import wins) and
 * persist. Capped at {@link MAX_TEMPLATES} newest first.
 * @param storage - readable and writable storage.
 * @param incoming - imported templates.
 * @returns the number of templates written.
 */
export declare function mergeTemplates(storage: StorageLike, incoming: readonly TemplateRecord[]): number;
//# sourceMappingURL=templates.d.ts.map