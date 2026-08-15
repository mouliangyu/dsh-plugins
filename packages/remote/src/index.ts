/** Persistent remote top-level projects over a private Unix-domain control socket. @module dsh-remote */

import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { createServer, type Socket } from 'node:net'
import type { Readable, Writable } from 'node:stream'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { createUserMessage, type ContentBlock } from '@deepseek-ai/dsh-llm'
import { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol'
import { SessionId, type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'

declare module '@deepseek-ai/cordis' { interface Context { remoteProjectHost: RemoteProjectHost } }

/** One configured or persisted remote project. */
export interface RemoteProjectConfig {
  /** Stable identifier selected by local project references. */
  id: string
  /** Absolute root directory on the remote host. */
  root: string
}

/** Host process configuration. */
export interface Config {
  /** Absolute private Unix-socket path served by this remote host. */
  socketPath: string
  /** Initial project roots used when no persistent registry exists. */
  projects?: RemoteProjectConfig[]
  /** Absolute JSON file updated by remote project-management methods. */
  projectsFile?: string
  /** Model-provider route for sessions created or resumed by the host. */
  provider?: string
  /** Model identifier for sessions created or resumed by the host. */
  model?: string
}

interface Project { id: string; root: string }

interface ProjectRegistryFile { version: 0; projects: RemoteProjectConfig[] }

interface SessionRecord { readonly handle: AgentHandle; readonly project: Project }

/** Serve persistent remote projects and their root sessions through a private Unix socket. */
export class RemoteProjectHost extends Service {
  static Config: z<Config> = z.object({
    socketPath: z.string().required(),
    projects: z.array(z.object({ id: z.string().required(), root: z.string().required() })).default([]),
    projectsFile: z.string(),
    provider: z.string().default('deepseek-official'),
    model: z.string().default('deepseek-v4-flash'),
  })

  private readonly projects = new Map<string, Project>()
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly connections = new Set<JsonRpcLineTransport>()
  private projectWrites: Promise<void> = Promise.resolve()

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'remoteProjectHost')
    for (const entry of config.projects ?? []) this.addConfiguredProject(entry)
  }

  /** Start the private listener; the host, rather than any SSH connection, owns live session handles. */
  async [Service.init](): Promise<void> {
    await this.loadProjectRegistry()
    const socketPath = resolve(this.config.socketPath)
    try {
      const stat = await lstat(socketPath)
      if (!stat.isSocket()) throw new Error(`remote project socket path already exists and is not a socket: ${socketPath}`)
      await unlink(socketPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const server = createServer((socket) => { this.attach(socket) })
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject)
      server.listen(socketPath, () => { server.off('error', reject); resolveListen() })
    })
    await chmod(socketPath, 0o600)
    this.ctx.effect(() => async () => {
      for (const connection of this.connections) connection.close()
      await this.projectWrites
      await new Promise<void>((resolveClose) => { server.close(() => { resolveClose() }) })
      await unlink(socketPath).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      })
    }, 'remoteProjectHost.socket')
  }

  private attach(socket: Socket): void {
    const close = this.serve(socket, socket)
    socket.once('close', close)
  }

  /** Bind one private JSON-RPC stream; its disposer releases subscriptions without stopping the host. */
  private serve(input: Readable, output: Writable): () => void {
    const transport = new JsonRpcLineTransport(input, output)
    this.connections.add(transport)
    const subscriptions = new Map<string, () => void>()
    const close = (): void => {
      for (const dispose of subscriptions.values()) dispose()
      subscriptions.clear()
      this.connections.delete(transport)
      transport.close()
    }
    transport.onRequest(async (method, params) => {
      switch (method) {
        case 'remote/hello': return { protocolVersion: 2, projects: [...this.projects.values()] }
        case 'remote/projects/create': return { project: await this.createProject({
          id: stringParam(params, 'projectId'), root: stringParam(params, 'projectRoot'),
        }) }
        case 'remote/sessions/list': return { sessions: await this.list(this.project(params)) }
        case 'remote/sessions/create': return { sessionId: await this.create(this.project(params)) }
        case 'remote/sessions/resume': await this.resume(this.project(params), stringParam(params, 'sessionId')); return {}
        case 'remote/sessions/prompt': return { messageId: await this.prompt(this.project(params), stringParam(params, 'sessionId'), contentBlocks(params)) }
        case 'remote/sessions/cancel': this.record(this.project(params), stringParam(params, 'sessionId')).handle.agent.cancel({ kind: 'user' }); return {}
        case 'remote/events/subscribe': {
          const project = this.project(params)
          const sessionId = stringParam(params, 'sessionId')
          const fromSeq = numberParam(params, 'fromSeq')
          const key = `${project.id}:${sessionId}`
          subscriptions.get(key)?.()
          await this.resume(project, sessionId)
          let replaying = true
          const delivered = new Set<number>()
          const pending: SessionEvent[] = []
          const deliver = (event: SessionEvent): void => {
            if (event.seq < fromSeq || delivered.has(event.seq)) return
            delivered.add(event.seq)
            transport.notify('remote/session.event', { projectId: project.id, sessionId, event })
          }
          const dispose = this.ctx.on('session/event', (session, event) => {
            if (String(session.id) !== sessionId) return
            if (replaying) pending.push(event)
            else deliver(event)
          })
          subscriptions.set(key, dispose)
          // Buffer live events while the durable suffix establishes the replay
          // prefix. This prevents an event produced during the read from
          // arriving before an older persisted event.
          const persisted = await this.persistence().readFrom(SessionId(sessionId), fromSeq)
          for (const event of persisted.events) deliver(event)
          replaying = false
          for (const event of pending.sort((left, right) => left.seq - right.seq)) deliver(event)
          return {}
        }
        default: throw new Error(`unknown remote method: ${method}`)
      }
    })
    transport.start()
    return close
  }

  private project(params: Record<string, unknown>): Project {
    const project = this.projects.get(stringParam(params, 'projectId'))
    if (project === undefined) throw new Error('unknown remote project')
    return project
  }

  private addConfiguredProject(entry: RemoteProjectConfig): void {
    const project = normalizeProject(entry)
    if (this.projects.has(project.id)) throw new Error(`duplicate remote project id: ${JSON.stringify(project.id)}`)
    this.projects.set(project.id, project)
  }

  private async loadProjectRegistry(): Promise<void> {
    const path = this.config.projectsFile
    if (path === undefined) return
    if (!isAbsolute(path)) throw new Error('remote projectsFile must be absolute')
    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await this.persistProjects()
      return
    }
    const stored = parseProjectRegistry(raw, path)
    this.projects.clear()
    for (const entry of stored.projects) this.addConfiguredProject(entry)
  }

  private createProject(entry: RemoteProjectConfig): Promise<Project> {
    const path = this.config.projectsFile
    if (path === undefined) throw new Error('remote project creation requires projectsFile')
    const project = normalizeProject(entry)
    return this.queueProjectWrite(async () => {
      if (this.projects.has(project.id)) throw new Error(`remote project already exists: ${JSON.stringify(project.id)}`)
      await mkdir(project.root, { recursive: true })
      this.projects.set(project.id, project)
      try {
        await this.persistProjects()
      } catch (error) {
        this.projects.delete(project.id)
        throw error
      }
      return project
    })
  }

  private queueProjectWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.projectWrites.then(operation, operation)
    this.projectWrites = result.then(() => {}, () => {})
    return result
  }

  private async persistProjects(): Promise<void> {
    const path = this.config.projectsFile
    if (path === undefined) return
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`
    const document: ProjectRegistryFile = { version: 0, projects: [...this.projects.values()] }
    try {
      await writeFile(temporary, JSON.stringify(document, undefined, 2) + '\n', {
        encoding: 'utf8', flag: 'wx', mode: 0o600,
      })
      await rename(temporary, path)
    } finally {
      await unlink(temporary).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      })
    }
  }

  private async create(project: Project): Promise<string> {
    const sessionId = `remote-${randomUUID()}`
    const handle = await this.ctx.agents.create({
      sessionId: SessionId(sessionId), meta: { cwd: project.root }, agentOptions: this.agentOptions(),
    })
    this.sessions.set(sessionId, { handle, project })
    return sessionId
  }

  private async resume(project: Project, sessionId: string): Promise<SessionRecord> {
    const live = this.sessions.get(sessionId)
    if (live !== undefined) {
      if (live.project.id !== project.id) throw new Error('remote session belongs to another project')
      return live
    }
    const stored = await this.persistence().inspect(SessionId(sessionId))
    if (stored.meta.cwd !== project.root) throw new Error('remote session belongs to another project')
    const handle = await this.ctx.agents.resume({ resumeSessionId: SessionId(sessionId), agentOptions: this.agentOptions() })
    const record = { handle, project }
    this.sessions.set(sessionId, record)
    return record
  }

  private record(project: Project, sessionId: string): SessionRecord {
    const record = this.sessions.get(sessionId)
    if (record === undefined || record.project.id !== project.id) throw new Error('remote session is not attached')
    return record
  }

  private async prompt(project: Project, sessionId: string, content: ContentBlock[]): Promise<string> {
    const record = await this.resume(project, sessionId)
    const message = createUserMessage({ content, source: { kind: 'user' } })
    record.handle.agent.followup(message)
    return String(message.id)
  }

  private async list(project: Project): Promise<SessionHeader[]> {
    const stored = await this.persistence().list()
    const live = [...this.sessions.values()].map(record => record.handle.agent.session.header)
    return [...new Map(
      [...stored, ...live]
        .filter(header => header.cwd === project.root)
        .map(header => [String(header.id), header]),
    ).values()]
  }

  private persistence(): SessionPersistence {
    const persistence = this.ctx.get('sessionPersistence')
    if (persistence === undefined) throw new Error('remote host requires sessionPersistence')
    return persistence
  }

  private agentOptions(): { provider?: string; model?: string } {
    return {
      ...(this.config.provider === undefined ? {} : { provider: this.config.provider }),
      ...(this.config.model === undefined ? {} : { model: this.config.model }),
    }
  }
}

function stringParam(params: Record<string, unknown>, key: string): string {
  const value = params[key]
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`remote ${key} must be a non-empty string`)
  return value
}

function numberParam(params: Record<string, unknown>, key: string): number {
  const value = params[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`remote ${key} must be a non-negative safe integer`)
  return value
}

function contentBlocks(params: Record<string, unknown>): ContentBlock[] {
  const value = params['contentBlocks']
  if (!Array.isArray(value)) throw new TypeError('remote contentBlocks must be an array')
  return value as ContentBlock[]
}

export default RemoteProjectHost

/** One remote session event delivered after an explicit subscription. */
export interface RemoteSessionEvent { projectId: string; sessionId: string; event: SessionEvent }

/** Thin client for an SSH-bridged remote JSON-RPC stream. */
export class RemoteProjectClient {
  private readonly transport: JsonRpcLineTransport
  private readonly eventListeners = new Set<(event: RemoteSessionEvent) => void>()

  /** @param input - bytes read from the SSH command's stdout. @param output - bytes written to its stdin. */
  constructor(input: Readable, output: Writable) {
    this.transport = new JsonRpcLineTransport(input, output)
    this.transport.onNotification((method, params) => {
      if (method !== 'remote/session.event') return
      const projectId = params['projectId']
      const sessionId = params['sessionId']
      const event = params['event']
      if (typeof projectId === 'string' && typeof sessionId === 'string' && event !== null && typeof event === 'object') {
        const notification = { projectId, sessionId, event: event as SessionEvent }
        for (const listener of this.eventListeners) listener(notification)
      }
    })
    this.transport.start()
  }

  /**
   * Subscribe to realtime events on this transport.
   * @param listener - callback for durable session events.
   * @returns disposer removing this listener.
   */
  onEvent(listener: (event: RemoteSessionEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => { this.eventListeners.delete(listener) }
  }

  /**
   * Request remote project inventory and protocol version.
   * @returns the handshake result.
   */
  hello(): Promise<unknown> { return this.transport.request('remote/hello', {}) }
  /**
   * List persisted root sessions belonging to one remote project.
   * @param projectId - remote project id.
   * @returns the wire result.
   */
  list(projectId: string): Promise<unknown> { return this.transport.request('remote/sessions/list', { projectId }) }
  /**
   * Create one root session in a remote project.
   * @param projectId - remote project id.
   * @returns the new session result.
   */
  create(projectId: string): Promise<unknown> { return this.transport.request('remote/sessions/create', { projectId }) }
  /**
   * Create one persistent project on the remote host; duplicate ids reject.
   * @param projectId - stable remote project id.
   * @param projectRoot - absolute directory on the remote host.
   * @returns the stored project record.
   */
  createProject(projectId: string, projectRoot: string): Promise<unknown> {
    return this.transport.request('remote/projects/create', { projectId, projectRoot })
  }
  /**
   * Resume a stored root session on the remote host.
   * @param projectId - remote project id.
   * @param sessionId - stored root session id.
   * @returns the wire result.
   */
  resume(projectId: string, sessionId: string): Promise<unknown> { return this.transport.request('remote/sessions/resume', { projectId, sessionId }) }
  /**
   * Queue a user message on a remote root session.
   * @param projectId - remote project id.
   * @param sessionId - root session id.
   * @param contentBlocks - user message blocks.
   * @returns the durable message receipt.
   */
  prompt(projectId: string, sessionId: string, contentBlocks: ContentBlock[]): Promise<unknown> {
    return this.transport.request('remote/sessions/prompt', { projectId, sessionId, contentBlocks })
  }
  /**
   * Cancel active work and queued follow-ups on a remote root session.
   * @param projectId - remote project id.
   * @param sessionId - root session id.
   * @returns the wire result.
   */
  cancel(projectId: string, sessionId: string): Promise<unknown> { return this.transport.request('remote/sessions/cancel', { projectId, sessionId }) }
  /**
   * Replay and then stream durable session events from a sequence watermark.
   * @param projectId - remote project id.
   * @param sessionId - root session id.
   * @param fromSeq - first sequence to replay.
   * @returns the subscription receipt.
   */
  subscribe(projectId: string, sessionId: string, fromSeq: number): Promise<unknown> {
    return this.transport.request('remote/events/subscribe', { projectId, sessionId, fromSeq })
  }
  /** Close the SSH transport without stopping the remote host or its sessions. */
  close(): void { this.transport.close() }
}

function normalizeProject(entry: RemoteProjectConfig): Project {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(entry.id)) {
    throw new Error(`invalid remote project id: ${JSON.stringify(entry.id)}`)
  }
  if (!isAbsolute(entry.root)) throw new Error(`remote project root must be absolute: ${JSON.stringify(entry.root)}`)
  return { id: entry.id, root: resolve(entry.root) }
}

function parseProjectRegistry(raw: string, path: string): ProjectRegistryFile {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    throw new Error(`failed to parse remote project registry ${path}: ${String(error)}`)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`remote project registry must hold an object: ${path}`)
  }
  const record = value as { version?: unknown; projects?: unknown }
  if (record.version !== 0 || !Array.isArray(record.projects)) {
    throw new Error(`unsupported remote project registry format: ${path}`)
  }
  for (const entry of record.projects) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`invalid remote project registry entry: ${path}`)
    }
    const project = entry as { id?: unknown; root?: unknown }
    if (typeof project.id !== 'string' || typeof project.root !== 'string') {
      throw new Error(`invalid remote project registry entry: ${path}`)
    }
  }
  return record as ProjectRegistryFile
}
