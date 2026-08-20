import z from "@deepseek-ai/schemastery";
import { escapeText, isModelInvocable } from "@deepseek-ai/dsh-skill";
//#region lib/types/index.js
/**
* Stable per-step skill catalog for DeepSeek Harness.
*
* Renders the skill catalog as a system-prompt section on every step —
* fixed position, never dropped by compaction — and suppresses the built-in
* digest-driven catalog message so the model sees exactly one authoritative
* catalog with mandatory trigger rules.
*
* @module dsh-skill-stabilizer
*/
const name = "skill-stabilizer";
const inject = ["skills"];
const DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH = 500;
/**
* Default aggregate cap for the rendered catalog section, in bytes. Kept at
* 20K bytes as a conservative guardrail; deployments with more skills override
* it. Descriptions are shortened, never names.
*/
const DEFAULT_CATALOG_MAX_BYTES = 2e4;
/** System-prompt section name the catalog is injected under. */
const CATALOG_SECTION_NAME = "skill:catalog";
/**
* The built-in `dsh-tool-skill` catalog message source kind. The stabilizer
* filters these messages out of each step so only its own section presents
* the catalog; user-explicit `/name` skill invocations are a different
* source kind and stay untouched.
*/
const BUILTIN_CATALOG_SOURCE_KIND = "skill-catalog";
/** Entry list mirroring the rendered catalog lines, for non-model consumers. */
function catalogSourceEntries(skills, descriptionMaxLength) {
	return skills.map((skill) => ({
		name: skill.name,
		description: catalogDescription(skill.description, descriptionMaxLength)
	}));
}
/** Validate and default the model-facing skill catalog configuration. */
const Config = z.object({
	catalogDescriptionMaxLength: z.number().default(DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH),
	catalogMaxBytes: z.number().default(DEFAULT_CATALOG_MAX_BYTES),
	suppressBuiltinCatalog: z.boolean().default(true)
});
/**
* Register the per-step skill catalog section and the built-in catalog
* suppression. The catalog section is appended by the `system-prompt/assemble`
* waterfall, which runs inside every step's prompt assembly, so the catalog is
* re-rendered at a fixed position each step instead of sinking into message
* history — the material stays visible regardless of how long the session
* grows or what compaction hides.
*/
function apply(ctx, config = {}) {
	const catalogDescriptionMaxLength = config.catalogDescriptionMaxLength ?? DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH;
	assertPositiveInteger("catalogDescriptionMaxLength", catalogDescriptionMaxLength, 3);
	const catalogMaxBytes = config.catalogMaxBytes ?? DEFAULT_CATALOG_MAX_BYTES;
	assertPositiveInteger("catalogMaxBytes", catalogMaxBytes, 1);
	if (config.suppressBuiltinCatalog ?? true) ctx.on("agent/pre-step", async (_payload, next) => {
		const decision = await next();
		if (decision.kind === "reject") return decision;
		const messages = decision.messages.filter((message) => !isBuiltinCatalogMessage(message));
		if (messages.length === decision.messages.length) return decision;
		return {
			kind: "enter",
			messages
		};
	});
	const lastGood = /* @__PURE__ */ new WeakMap();
	ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
		const assembled = await next();
		const agent = context.agent;
		if (agent === void 0) return assembled;
		const signal = context.signal;
		signal?.throwIfAborted();
		const snapshot = await ctx.skills.snapshot({
			cwd: agent.session.header.cwd,
			signal,
			scope: agent
		});
		signal?.throwIfAborted();
		const skills = snapshot.complete ? snapshot.skills.filter(isModelInvocable) : void 0;
		let entries;
		if (skills !== void 0) {
			entries = catalogSourceEntries(skills, catalogDescriptionMaxLength);
			lastGood.set(agent, entries);
		} else entries = lastGood.get(agent);
		if (entries === void 0 || entries.length === 0) return assembled;
		return {
			...assembled,
			sections: [...assembled.sections, {
				name: CATALOG_SECTION_NAME,
				text: renderCatalogSection(entries, catalogMaxBytes)
			}]
		};
	});
}
/**
* Model-facing catalog section text: the ordered name-and-description list and
* the trigger rule. The rule is mandatory and accountable — matching a skill's
* description obligates its use, and skipping an obvious match requires an
* explanation — rather than an optional reminder. Loading a skill obligates
* consulting it at every later decision point the skill governs, so a loaded
* skill stays authoritative instead of becoming background context.
*/
function renderCatalogSection(entries, maxBytes) {
	const body = (list) => [
		"A skill is a reusable set of task-specific instructions. The following skills are available in this session:",
		"",
		"<available_skills>",
		...renderCatalogEntries(list),
		"</available_skills>",
		"",
		"If the user names a skill, or the task clearly matches a skill's description, you MUST use that skill this turn. Announce which skills you are using and why. If you skip an obviously-matching skill, say why. Do not carry skills across turns unless re-mentioned. Call the `skill` tool with the exact skill name to load the full instructions before acting; the entries above are summaries only.",
		"Loading a skill is not a one-time read: at every later decision point the skill governs — choosing an entry path, handling a mismatch or failure, picking a tool or environment — return to the loaded skill content and route from its instructions before acting. Do not fall back to generic habit while a loaded skill covers the situation; if the skill does not cover it, say so and ask rather than guess.",
		"A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool again for that skill."
	].join("\n");
	if (maxBytes === void 0) return body(entries);
	const full = body(entries);
	if (utf8Bytes(full) <= maxBytes) return full;
	const available = maxBytes - utf8Bytes(body(entries.map((entry) => ({
		...entry,
		description: ""
	}))));
	if (available <= 0) return body(entries.map((entry) => ({
		...entry,
		description: ""
	})));
	const perEntry = Math.floor(available / entries.length);
	return body(entries.map((entry) => ({
		...entry,
		description: truncateUtf8(entry.description, perEntry)
	})));
}
/** UTF-8 byte length of a string, for catalog budgeting. */
function utf8Bytes(value) {
	return new TextEncoder().encode(value).length;
}
/** Longest prefix of `value` that fits in `maxBytes` UTF-8 bytes, never splitting a code point. */
function truncateUtf8(value, maxBytes) {
	if (utf8Bytes(value) <= maxBytes) return value;
	let lo = 0;
	let hi = value.length;
	while (lo < hi) {
		const mid = lo + hi + 1 >> 1;
		if (utf8Bytes(value.slice(0, mid)) <= maxBytes) lo = mid;
		else hi = mid - 1;
	}
	return value.slice(0, lo);
}
/**
* Model-facing catalog lines, projected from the entries the section records.
* The pseudo-XML escaping belongs to this frame. Names are `isSkillName`-validated
* and carry no escapable character.
*/
function renderCatalogEntries(entries) {
	return entries.map((entry) => `- \`${entry.name}\`: ${escapeCatalogDescription(entry.description)}`);
}
/**
* Description prose escaped for the system-prompt section. The section text is
* passed through `renderPrompt`'s strict `{{variable}}` interpolation, so braces
* are HTML-entity-escaped alongside the `escapeText` set to keep a description
* such as `{{placeholder}}` literal instead of an unknown variable reference.
*/
function escapeCatalogDescription(value) {
	return escapeText(value).replaceAll("{", "&#123;").replaceAll("}", "&#125;");
}
/** Normalized, length-bounded description exactly as the catalog publishes it (unescaped). */
function catalogDescription(value, maxLength) {
	const normalized = value.replaceAll(/\s+/g, " ").trim();
	return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}
/** Whether a message is the built-in `dsh-tool-skill` catalog publication. */
function isBuiltinCatalogMessage(message) {
	return message.source?.kind === BUILTIN_CATALOG_SOURCE_KIND;
}
function assertPositiveInteger(name, value, minimum = 1) {
	if (!Number.isInteger(value) || value < minimum) throw new Error(`skill-stabilizer: ${name} must be an integer greater than or equal to ${minimum}`);
}
//#endregion
export { Config, apply, inject, name };
