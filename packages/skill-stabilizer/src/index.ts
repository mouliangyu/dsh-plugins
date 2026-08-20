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

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { UserMessage } from '@deepseek-ai/dsh-session'
import { escapeText, isModelInvocable, type SkillSummary } from '@deepseek-ai/dsh-skill'

export const name = 'skill-stabilizer'
export const inject = ['skills']

const DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH = 500
/**
 * Default aggregate cap for the rendered catalog section, in bytes. Kept at
 * 20K bytes as a conservative guardrail; deployments with more skills override
 * it. Descriptions are shortened, never names.
 */
const DEFAULT_CATALOG_MAX_BYTES = 20000
/** System-prompt section name the catalog is injected under. */
const CATALOG_SECTION_NAME = 'skill:catalog'
/**
 * The built-in `dsh-tool-skill` catalog message source kind. The stabilizer
 * filters these messages out of each step so only its own section presents
 * the catalog; user-explicit `/name` skill invocations are a different
 * source kind and stay untouched.
 */
const BUILTIN_CATALOG_SOURCE_KIND = 'skill-catalog'

/** One name-and-description entry rendered into the model-facing skill catalog. */
interface SkillCatalogEntry {
  readonly name: string
  readonly description: string
}

type CatalogEntries = readonly SkillCatalogEntry[]

/** Entry list mirroring the rendered catalog lines, for non-model consumers. */
function catalogSourceEntries(
  skills: SkillSummary[],
  descriptionMaxLength: number,
): CatalogEntries {
  return skills.map(skill => ({
    name: skill.name,
    description: catalogDescription(skill.description, descriptionMaxLength),
  }))
}

/** Model-facing skill catalog configuration. */
export interface Config {
  /** Maximum normalized description length rendered in the session catalog; minimum 3. */
  catalogDescriptionMaxLength?: number
  /**
   * Maximum total byte size of the rendered catalog section. When the section
   * exceeds it, descriptions are shortened equally to fit; skill names are
   * never truncated or dropped. Defaults to `20000`.
   */
  catalogMaxBytes?: number
  /**
   * Filter the built-in `dsh-tool-skill` catalog message out of every step so
   * only this plugin's system-prompt section presents the catalog. Defaults to
   * `true`. Set to `false` to keep the built-in message (two catalogs visible).
   */
  suppressBuiltinCatalog?: boolean
}

/** Validate and default the model-facing skill catalog configuration. */
export const Config: z<Config> = z.object({
  catalogDescriptionMaxLength: z.number().default(DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH),
  catalogMaxBytes: z.number().default(DEFAULT_CATALOG_MAX_BYTES),
  suppressBuiltinCatalog: z.boolean().default(true),
})

/**
 * Register the per-step skill catalog section and the built-in catalog
 * suppression. The catalog section is appended by the `system-prompt/assemble`
 * waterfall, which runs inside every step's prompt assembly, so the catalog is
 * re-rendered at a fixed position each step instead of sinking into message
 * history — the material stays visible regardless of how long the session
 * grows or what compaction hides.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const catalogDescriptionMaxLength = config.catalogDescriptionMaxLength ?? DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH
  assertPositiveInteger('catalogDescriptionMaxLength', catalogDescriptionMaxLength, 3)
  const catalogMaxBytes = config.catalogMaxBytes ?? DEFAULT_CATALOG_MAX_BYTES
  assertPositiveInteger('catalogMaxBytes', catalogMaxBytes, 1)
  const suppressBuiltinCatalog = config.suppressBuiltinCatalog ?? true

  // The built-in `dsh-tool-skill` plugin publishes its catalog as a
  // digest-driven user message on `agent/pre-step`. Registering this listener
  // after that plugin (the plugin ordering in the preset) makes `next()` hand
  // it the complete message list, from which the catalog message is removed.
  // A `reject` decision and the user-explicit `/name` skill-invocation
  // messages pass through untouched.
  if (suppressBuiltinCatalog) {
    ctx.on('agent/pre-step', async (
      _payload,
      next,
    ): Promise<PreStepDecision> => {
      const decision = await next()
      if (decision.kind === 'reject') return decision
      const messages = decision.messages.filter(message => !isBuiltinCatalogMessage(message))
      if (messages.length === decision.messages.length) return decision
      return { kind: 'enter', messages }
    })
  }

  // Per-step skill catalog in the system prompt. Incomplete discovery keeps
  // the last-good entry list rather than dropping the catalog for a step; the
  // empty initial view contributes nothing until a model-invocable skill
  // exists.
  const lastGood = new WeakMap<Agent, CatalogEntries>()
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context.agent
    if (agent === undefined) return assembled
    const signal = context.signal
    signal?.throwIfAborted()
    const snapshot = await ctx.skills.snapshot({ cwd: agent.session.header.cwd, signal, scope: agent })
    signal?.throwIfAborted()
    const skills = snapshot.complete ? snapshot.skills.filter(isModelInvocable) : undefined
    let entries: CatalogEntries | undefined
    if (skills !== undefined) {
      entries = catalogSourceEntries(skills, catalogDescriptionMaxLength)
      lastGood.set(agent, entries)
    } else {
      entries = lastGood.get(agent)
    }
    if (entries === undefined || entries.length === 0) return assembled
    return {
      ...assembled,
      sections: [...assembled.sections, { name: CATALOG_SECTION_NAME, text: renderCatalogSection(entries, catalogMaxBytes) }],
    }
  })
}

/**
 * Model-facing catalog section text: the ordered name-and-description list and
 * the trigger rule. The rule is mandatory and accountable — matching a skill's
 * description obligates its use, and skipping an obvious match requires an
 * explanation — rather than an optional reminder. Loading a skill obligates
 * consulting it at every later decision point the skill governs, so a loaded
 * skill stays authoritative instead of becoming background context.
 */
function renderCatalogSection(entries: CatalogEntries, maxBytes: number | undefined): string {
  const body = (list: CatalogEntries): string => [
    'A skill is a reusable set of task-specific instructions. The following skills are available in this session:',
    '',
    '<available_skills>',
    ...renderCatalogEntries(list),
    '</available_skills>',
    '',
    "If the user names a skill, or the task clearly matches a skill's description, you MUST use that skill this turn. Announce which skills you are using and why. If you skip an obviously-matching skill, say why. Do not carry skills across turns unless re-mentioned. Call the `skill` tool with the exact skill name to load the full instructions before acting; the entries above are summaries only.",
    'Loading a skill is not a one-time read: at every later decision point the skill governs — choosing an entry path, handling a mismatch or failure, picking a tool or environment — return to the loaded skill content and route from its instructions before acting. Do not fall back to generic habit while a loaded skill covers the situation; if the skill does not cover it, say so and ask rather than guess.',
    'A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool again for that skill.',
  ].join('\n')
  if (maxBytes === undefined) return body(entries)
  const full = body(entries)
  if (utf8Bytes(full) <= maxBytes) return full
  // Shorten descriptions equally to fit. The fixed framing (the entry lines'
  // `- \`name\`: ` prefixes and the surrounding prose) is measured with empty
  // descriptions, so names are never truncated or dropped.
  const fixed = utf8Bytes(body(entries.map(entry => ({ ...entry, description: '' }))))
  const available = maxBytes - fixed
  if (available <= 0) return body(entries.map(entry => ({ ...entry, description: '' })))
  const perEntry = Math.floor(available / entries.length)
  return body(entries.map(entry => ({ ...entry, description: truncateUtf8(entry.description, perEntry) })))
}

/** UTF-8 byte length of a string, for catalog budgeting. */
function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length
}

/** Longest prefix of `value` that fits in `maxBytes` UTF-8 bytes, never splitting a code point. */
function truncateUtf8(value: string, maxBytes: number): string {
  if (utf8Bytes(value) <= maxBytes) return value
  let lo = 0
  let hi = value.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (utf8Bytes(value.slice(0, mid)) <= maxBytes) lo = mid
    else hi = mid - 1
  }
  return value.slice(0, lo)
}

/**
 * Model-facing catalog lines, projected from the entries the section records.
 * The pseudo-XML escaping belongs to this frame. Names are `isSkillName`-validated
 * and carry no escapable character.
 */
function renderCatalogEntries(entries: CatalogEntries): string[] {
  return entries.map(entry => `- \`${entry.name}\`: ${escapeCatalogDescription(entry.description)}`)
}

/**
 * Description prose escaped for the system-prompt section. The section text is
 * passed through `renderPrompt`'s strict `{{variable}}` interpolation, so braces
 * are HTML-entity-escaped alongside the `escapeText` set to keep a description
 * such as `{{placeholder}}` literal instead of an unknown variable reference.
 */
function escapeCatalogDescription(value: string): string {
  return escapeText(value)
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;')
}

/** Normalized, length-bounded description exactly as the catalog publishes it (unescaped). */
function catalogDescription(value: string, maxLength: number): string {
  const normalized = value.replaceAll(/\s+/g, ' ').trim()
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`
}

/** Whether a message is the built-in `dsh-tool-skill` catalog publication. */
function isBuiltinCatalogMessage(message: UserMessage): boolean {
  return (message.source as { kind?: unknown } | undefined)?.kind === BUILTIN_CATALOG_SOURCE_KIND
}

function assertPositiveInteger(name: string, value: number, minimum = 1): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`skill-stabilizer: ${name} must be an integer greater than or equal to ${minimum}`)
  }
}
