import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { createScope, type Scope } from '@deepseek-ai/dsh-scope'
import { Session, SessionId, type UserMessage } from '@deepseek-ai/dsh-session'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import AgentRegistry, { agentEvents, Inbox, type Agent, type PreStepDecision } from '@deepseek-ai/dsh-agent'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem'
import * as stabilizer from '../src/index.ts'

async function tempDir(name: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), `dsh-${name}-`))
}

async function setup(home: string, config: stabilizer.Config = {}): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SkillFileSystem, { dshHome: join(home, '.dsh'), agentsHome: join(home, '.agents'), watch: false })
  await ctx.plugin(stabilizer, config)
  return ctx
}

function agentForCwd(cwd: string): Agent {
  const id = SessionId(`stabilizer-${cwd}`)
  const session = Session.create(id, [], { version: 0, id, createdAt: 0, cwd })
  return {
    ctx: new Context(),
    id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => { throw new Error('stabilizer must not use agent.inject()') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

async function mintAgentScope(ctx: Context, subject: string | Agent): Promise<{ agent: Agent; scope: Scope }> {
  const agent = typeof subject === 'string' ? agentForCwd(subject) : subject
  let scope!: Scope
  await ctx.plugin(Object.assign((inner: Context) => { scope = createScope(inner, agent) }, {
    inject: ['skills'],
  }))
  return { agent, scope }
}

async function systemPromptText(ctx: Context, agent: Agent, signal = new AbortController().signal): Promise<string> {
  return renderPrompt(await ctx.systemPrompt.assemble({ agent, scope: agent, signal }))
}

async function proposeStep(
  ctx: Context,
  agent: Agent,
  messages: UserMessage[],
): Promise<PreStepDecision> {
  const signal = new AbortController().signal
  return await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages, turn: 1, step: 1, signal },
    () => Promise.resolve({ kind: 'enter' as const, messages }),
  )
}

function builtinCatalogMessage(): UserMessage {
  // `skill-catalog` is a `dsh-tool-skill` plugin-declared source kind, absent
  // from rc.6's `MessageSourceMap`; cast through `unknown` to model the message
  // the built-in plugin publishes on `agent/pre-step`.
  return {
    ...createUserMessage({ content: [{ type: 'text', text: '<system-reminder>builtin catalog</system-reminder>' }], source: { kind: 'user' } }),
    source: { kind: 'skill-catalog', form: 'catalog', entries: [] },
  } as unknown as UserMessage
}

function plainUserMessage(text: string): UserMessage {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

/** Register one model-invocable skill on the runtime registry. */
function registerSkill(
  ctx: Context,
  name: string,
  description: string,
): void {
  ctx.skills.register({
    name,
    description,
    source: 'runtime',
    provider: 'runtime',
    content: `${name} body.`,
  })
}

describe('dsh-skill-stabilizer', () => {
  it('injects the catalog section with names and the mandatory trigger rule', async () => {
    const home = await tempDir('catalog')
    const ctx = await setup(home)
    registerSkill(ctx, 'alpha', 'Alpha skill for testing.')
    registerSkill(ctx, 'beta', 'Beta skill for testing.')
    const { agent } = await mintAgentScope(ctx, home)

    const text = await systemPromptText(ctx, agent)

    expect(text).toContain('<available_skills>')
    expect(text).toContain('- `alpha`: Alpha skill for testing.')
    expect(text).toContain('- `beta`: Beta skill for testing.')
    expect(text).toContain('you MUST use that skill this turn')
    expect(text).toContain('return to the loaded skill content and route from its instructions before acting')
  })

  it('renders nothing when no model-invocable skill exists', async () => {
    const home = await tempDir('empty')
    const ctx = await setup(home)
    const { agent } = await mintAgentScope(ctx, home)

    const text = await systemPromptText(ctx, agent)

    expect(text).not.toContain('<available_skills>')
  })

  it('shortens descriptions equally under the byte budget and never drops names', async () => {
    const home = await tempDir('budget')
    const ctx = await setup(home, { catalogMaxBytes: 2000 })
    for (let i = 0; i < 8; i++) {
      registerSkill(ctx, `skill-${i}`, `Skill number ${i} with a long description.`.repeat(40))
    }
    const { agent } = await mintAgentScope(ctx, home)

    const assembly = await ctx.systemPrompt.assemble({ agent, scope: agent })
    const section = assembly.sections.find(entry => entry.name === 'skill:catalog')
    expect(section).toBeDefined()
    const text = section!.text

    for (let i = 0; i < 8; i++) {
      expect(text).toContain(`- \`skill-${i}\``)
    }
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(2000)
    expect(text).not.toContain('long description'.repeat(2))
  })

  it('escapes braces so {{placeholder}} stays literal instead of a prompt variable', async () => {
    const home = await tempDir('braces')
    const ctx = await setup(home)
    registerSkill(ctx, 'alpha', 'Use {{placeholder}} literally.')
    const { agent } = await mintAgentScope(ctx, home)

    const text = await systemPromptText(ctx, agent)

    expect(text).toContain('Use &#123;&#123;placeholder&#125;&#125; literally.')
    expect(text).not.toContain('{{placeholder}}')
  })

  it('filters the built-in catalog message out of the step while keeping user messages', async () => {
    const home = await tempDir('suppress')
    const ctx = await setup(home)
    const { agent } = await mintAgentScope(ctx, home)

    const decision = await proposeStep(ctx, agent, [
      builtinCatalogMessage(),
      plainUserMessage('hello'),
    ])

    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    expect(decision.messages).toHaveLength(1)
    expect(decision.messages[0]?.content[0]?.type).toBe('text')
    expect((decision.messages[0]?.content[0] as { text?: string }).text).toBe('hello')
  })

  it('keeps the built-in catalog message when suppressBuiltinCatalog is false', async () => {
    const home = await tempDir('keep')
    const ctx = await setup(home, { suppressBuiltinCatalog: false })
    const { agent } = await mintAgentScope(ctx, home)

    const decision = await proposeStep(ctx, agent, [builtinCatalogMessage()])

    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    expect(decision.messages).toHaveLength(1)
  })

  it('passes reject decisions through untouched', async () => {
    const home = await tempDir('reject')
    const ctx = await setup(home)
    const { agent } = await mintAgentScope(ctx, home)
    const signal = new AbortController().signal

    const decision = await agentEvents(ctx, agent).waterfall(
      'agent/pre-step',
      { messages: [builtinCatalogMessage()], turn: 1, step: 1, signal },
      () => Promise.resolve({ kind: 'reject' as const }),
    )

    expect(decision).toEqual({ kind: 'reject' })
  })

  it('filters a catalog message injected earlier by the built-in plugin (registration-order contract)', async () => {
    const home = await tempDir('order')
    const ctx = await setup(home)
    // The built-in `dsh-tool-skill` registers its catalog publication before
    // this plugin in real presets; model that ordering by registering an
    // earlier listener that appends a catalog message to the decision.
    ctx.on('agent/pre-step', async ({ agent: _a, messages }, next): Promise<PreStepDecision> => {
      const decision = await next()
      if (decision.kind === 'reject') return decision
      return { kind: 'enter', messages: [...decision.messages, builtinCatalogMessage()] }
    })
    const { agent } = await mintAgentScope(ctx, home)

    const decision = await proposeStep(ctx, agent, [plainUserMessage('hello')])

    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    expect(decision.messages).toHaveLength(1)
    expect((decision.messages[0]?.content[0] as { text?: string }).text).toBe('hello')
  })

  it('rejects an invalid catalogMaxBytes configuration', async () => {
    await expect(setup(await tempDir('bad'), { catalogMaxBytes: 0 })).rejects.toThrow(
      'catalogMaxBytes must be an integer greater than or equal to 1',
    )
  })
})
