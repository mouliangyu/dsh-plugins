import { PassThrough } from 'node:stream'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { SessionId, type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session'
import { RemoteProjectClient, RemoteProjectHost } from '../src/index.ts'

type TestHost = { serve(input: PassThrough, output: PassThrough): () => void }

describe('RemoteProjectClient', () => {
  it('creates projects through the running host and persists their registry', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'dsh-remote-projects-'))
    try {
      const input = new PassThrough()
      const output = new PassThrough()
      const ctx = { reflect: { provide: vi.fn() } } as unknown as Context
      const projectsFile = join(temporary, 'state', 'projects.json')
      const projectRoot = join(temporary, 'workspace')
      const host = new RemoteProjectHost(ctx, {
        socketPath: join(temporary, 'remote.sock'), projectsFile, projects: [],
      })
      const dispose = (host as unknown as TestHost).serve(output, input)
      const client = new RemoteProjectClient(input, output)

      await expect(client.createProject('workspace', projectRoot)).resolves.toEqual({
        project: { id: 'workspace', root: projectRoot },
      })
      await expect(client.hello()).resolves.toMatchObject({
        protocolVersion: 2, projects: [{ id: 'workspace', root: projectRoot }],
      })
      expect((await stat(projectRoot)).isDirectory()).toBe(true)
      await expect(readFile(projectsFile, 'utf8')).resolves.toBe(JSON.stringify({
        version: 0, projects: [{ id: 'workspace', root: projectRoot }],
      }, undefined, 2) + '\n')
      await expect(client.createProject('workspace', join(temporary, 'other'))).rejects.toThrow('already exists')

      client.close()
      dispose()

      const resumedInput = new PassThrough()
      const resumedOutput = new PassThrough()
      const resumedHost = new RemoteProjectHost(ctx, {
        socketPath: join(temporary, 'resumed.sock'), projectsFile, projects: [],
      })
      await (resumedHost as unknown as { loadProjectRegistry(): Promise<void> }).loadProjectRegistry()
      const disposeResumed = (resumedHost as unknown as TestHost).serve(resumedOutput, resumedInput)
      const resumedClient = new RemoteProjectClient(resumedInput, resumedOutput)
      await expect(resumedClient.hello()).resolves.toMatchObject({
        projects: [{ id: 'workspace', root: projectRoot }],
      })
      resumedClient.close()
      disposeResumed()
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  })

  it('forwards only subscribed remote session events', () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const client = new RemoteProjectClient(input, output)
    const seen: string[] = []
    client.onEvent((event) => { seen.push(`${event.projectId}:${event.sessionId}:${event.event.seq}`) })
    input.write(JSON.stringify({ jsonrpc: '2.0', method: 'remote/session.event', params: {
      projectId: 'project', sessionId: 'remote-1', event: { type: 'turn/start', seq: 4, time: 0, data: {} },
    } }) + '\n')
    input.write(JSON.stringify({ jsonrpc: '2.0', method: 'session.event', params: {} }) + '\n')
    expect(seen).toEqual(['project:remote-1:4'])
    client.close()
  })

  it('fans one transport event out to independent observers', () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const client = new RemoteProjectClient(input, output)
    const first: number[] = []
    const second: number[] = []
    const disposeFirst = client.onEvent(({ event }) => { first.push(event.seq) })
    client.onEvent(({ event }) => { second.push(event.seq) })

    const notify = (seq: number): void => {
      input.write(JSON.stringify({ jsonrpc: '2.0', method: 'remote/session.event', params: {
        projectId: 'project', sessionId: 'remote-1', event: { type: 'turn/start', seq, time: 0, data: {} },
      } }) + '\n')
    }
    notify(1)
    disposeFirst()
    notify(2)

    expect(first).toEqual([1])
    expect(second).toEqual([1, 2])
    client.close()
  })

  it('replays the persisted suffix through one SSH stdio stream', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const persistedEvent: SessionEvent = { type: 'turn/start', seq: 4, time: 0, data: { turn: 1 } }
    const header = { id: SessionId('remote-old'), cwd: '/srv/project' } as SessionHeader
    const persistence = {
      inspect: vi.fn(async () => ({ meta: header, events: [persistedEvent] })),
      list: vi.fn(async () => [header]),
      readFrom: vi.fn(async () => ({ meta: header, events: [persistedEvent] })),
    }
    const handle = {
      agent: {
        session: { header, events: [{ ...persistedEvent, seq: 99 }] },
        followup: vi.fn(),
        cancel: vi.fn(),
      },
    } as unknown as AgentHandle
    const ctx = {
      reflect: { provide: vi.fn() },
      agents: {
        create: vi.fn(async () => handle),
        resume: vi.fn(async () => handle),
      },
      get: vi.fn((name: string) => name === 'sessionPersistence' ? persistence : undefined),
      on: vi.fn(() => () => {}),
      effect: vi.fn(),
    } as unknown as Context
    const host = new RemoteProjectHost(ctx, { socketPath: '/tmp/remote-test.sock', projects: [{ id: 'project', root: '/srv/project' }] })
    const dispose = (host as unknown as TestHost).serve(output, input)
    const client = new RemoteProjectClient(input, output)
    const seen: number[] = []
    client.onEvent(({ event }) => { seen.push(event.seq) })

    await expect(client.hello()).resolves.toMatchObject({ protocolVersion: 2, projects: [{ id: 'project', root: '/srv/project' }] })
    await expect(client.list('project')).resolves.toMatchObject({ sessions: [header] })
    await expect(client.subscribe('project', 'remote-old', 4)).resolves.toEqual({})

    expect(persistence.readFrom).toHaveBeenCalledWith(SessionId('remote-old'), 4)
    expect(seen).toEqual([4])
    client.close()
    dispose()
  })

  it('orders a live event after the durable suffix read', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const stored: SessionEvent = { type: 'turn/start', seq: 4, time: 0, data: { turn: 1 } }
    const live: SessionEvent = { type: 'turn/end', seq: 5, time: 0, data: { turn: 1, reason: { kind: 'completed' } } }
    const header = { id: SessionId('remote-old'), cwd: '/srv/project' } as SessionHeader
    const suffix = Promise.withResolvers<{ meta: SessionHeader; events: SessionEvent[] }>()
    let publish: ((session: { id: unknown }, event: SessionEvent) => void) | undefined
    const persistence = {
      inspect: vi.fn(async () => ({ meta: header, events: [stored] })),
      list: vi.fn(async () => [header]),
      readFrom: vi.fn(async () => suffix.promise),
    }
    const handle = { agent: { session: { header, events: [] }, followup: vi.fn(), cancel: vi.fn() } } as unknown as AgentHandle
    const ctx = {
      reflect: { provide: vi.fn() },
      agents: { create: vi.fn(async () => handle), resume: vi.fn(async () => handle) },
      get: vi.fn((name: string) => name === 'sessionPersistence' ? persistence : undefined),
      on: vi.fn((_name: string, listener: (session: { id: unknown }, event: SessionEvent) => void) => {
        publish = listener
        return () => {}
      }),
      effect: vi.fn(),
    } as unknown as Context
    const host = new RemoteProjectHost(ctx, { socketPath: '/tmp/remote-test.sock', projects: [{ id: 'project', root: '/srv/project' }] })
    const dispose = (host as unknown as TestHost).serve(output, input)
    const client = new RemoteProjectClient(input, output)
    const seen: number[] = []
    client.onEvent(({ event }) => { seen.push(event.seq) })

    const subscription = client.subscribe('project', 'remote-old', 4)
    await vi.waitFor(() => { expect(publish).toBeTypeOf('function') })
    publish?.({ id: SessionId('remote-old') }, live)
    suffix.resolve({ meta: header, events: [stored] })
    await subscription

    expect(seen).toEqual([4, 5])
    client.close()
    dispose()
  })
})
