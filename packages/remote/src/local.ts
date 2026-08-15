/** Local Web Host plugin for SSH-backed remote project management. */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import { RemoteProjectClient, type RemoteSessionEvent } from './index.ts'
import type { RemoteAction, RemoteConnectionConfig, RemoteProjectView, RemoteStateView, SshHostView } from './local-contract.ts'
import { discoverSshHostAliases } from './ssh-config.ts'
import { buildRemoteBootstrapScript, packRemotePlugin } from './bootstrap.ts'

export type * from './local-contract.ts'

export const name = 'dsh-remote-local'
export const inject = ['settings', 'webServer']

const API_PATH = '/dsh-remote/api'
const EVENTS_PATH = '/dsh-remote/events'
const MAX_BODY_BYTES = 1024 * 1024
const ID = /^[a-z][a-z0-9-]{0,63}$/
const SSH_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
const SOCKET_PATH = /^\/[A-Za-z0-9_./-]+$/
const OFFICIAL_DSH_PACKAGE = /^@deepseek-ai\/dsh@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const DEFAULT_REMOTE_DSH_PACKAGE = '@deepseek-ai/dsh@0.1.0-rc.6'

/** Local plugin composition defaults. */
export interface LocalConfig {
  connections?: RemoteConnectionConfig[]
  /** Exact official DSH release installed into the private remote runtime. */
  remoteDshPackage?: string
  /** OpenSSH connection timeout applied to bridges and bootstrap actions. */
  sshConnectTimeoutSeconds?: number
  /** Maximum duration of remote package installation and daemon startup. */
  bootstrapTimeoutMs?: number
}

export const Config: z<LocalConfig> = z.object({
  connections: z.array(z.object({
    id: z.string().required(),
    host: z.string().required(),
    socketPath: z.string().required(),
  })).default([]),
  remoteDshPackage: z.string().default(DEFAULT_REMOTE_DSH_PACKAGE),
  sshConnectTimeoutSeconds: z.number().min(1).max(120).default(10),
  bootstrapTimeoutMs: z.number().min(1_000).max(30 * 60_000).default(5 * 60_000),
})

const SETTINGS_NS = settingsNamespace('dsh-remote')

interface HelloResult { protocolVersion: number; projects: RemoteProjectView[] }
class Bridge {
  readonly client: RemoteProjectClient
  readonly process: ChildProcessWithoutNullStreams
  error: string | undefined

  constructor(readonly config: RemoteConnectionConfig, connectTimeoutSeconds: number, onExit: (error?: string) => void) {
    this.process = spawn('ssh', [
      '-T', '-o', 'BatchMode=yes', '-o', `ConnectTimeout=${connectTimeoutSeconds}`, config.host,
      `exec "$HOME/.local/share/dsh-remote/node" "$HOME/.dsh/profiles/dsh-remote/node_modules/dsh-remote/lib/bin.js" connect ${config.socketPath}`,
    ], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.client = new RemoteProjectClient(this.process.stdout, this.process.stdin)
    let stderr = ''
    this.process.stderr.setEncoding('utf8')
    this.process.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4096) })
    this.process.once('error', (error) => { onExit(error.message) })
    this.process.once('exit', (code, signal) => {
      const detail = stderr.trim()
      onExit(detail || `ssh exited (${code === null ? signal : String(code)})`)
    })
  }

  close(): void {
    this.client.close()
    this.process.kill('SIGTERM')
  }
}

class LocalRemoteManager {
  private readonly bridges = new Map<string, Bridge>()
  private readonly errors = new Map<string, string>()

  constructor(
    private readonly settings: SettingsScope<{ connections: RemoteConnectionConfig[] }>,
    private readonly options: Required<Pick<LocalConfig, 'remoteDshPackage' | 'sshConnectTimeoutSeconds' | 'bootstrapTimeoutMs'>>,
  ) {}

  state(): RemoteStateView {
    return { connections: this.settings.get().connections.map((connection) => {
      const error = this.errors.get(connection.id)
      return {
        ...connection,
        connected: this.bridges.has(connection.id),
        ...(error === undefined ? {} : { error }),
      }
    }) }
  }

  async run(action: RemoteAction): Promise<unknown> {
    switch (action.action) {
      case 'discoverHosts': return { hosts: (await discoverSshHostAliases()).map<SshHostView>(alias => ({ alias })) }
      case 'bootstrapHost': return this.bootstrap(action.connectionId)
      case 'createProject': return this.createProject(action.connectionId, action.projectId, action.projectRoot)
      case 'saveConnection': {
        validateConnection(action.connection)
        const current = this.settings.get().connections
        const next = [...current.filter(entry => entry.id !== action.connection.id), action.connection]
        this.disconnect(action.connection.id)
        await this.settings.replace({ connections: next })
        return this.state()
      }
      case 'removeConnection': {
        this.disconnect(action.connectionId)
        await this.settings.replace({ connections: this.settings.get().connections.filter(entry => entry.id !== action.connectionId) })
        return this.state()
      }
      case 'connect': return this.hello(action.connectionId)
      case 'disconnect': this.disconnect(action.connectionId); return this.state()
      case 'projects': return this.hello(action.connectionId)
      case 'sessions': return this.client(action.connectionId).list(action.projectId)
      case 'createSession': return this.client(action.connectionId).create(action.projectId)
      case 'resumeSession': return this.client(action.connectionId).resume(action.projectId, action.sessionId)
      case 'prompt': return this.client(action.connectionId).prompt(action.projectId, action.sessionId, [{ type: 'text', text: action.text }])
      case 'cancel': return this.client(action.connectionId).cancel(action.projectId, action.sessionId)
    }
  }

  async subscribe(
    connectionId: string,
    projectId: string,
    sessionId: string,
    fromSeq: number,
    listener: (event: RemoteSessionEvent) => void,
  ): Promise<() => void> {
    const client = this.client(connectionId)
    const dispose = client.onEvent((event) => {
      if (event.projectId === projectId && event.sessionId === sessionId) listener(event)
    })
    try {
      await client.subscribe(projectId, sessionId, fromSeq)
      return dispose
    } catch (error) {
      dispose()
      throw error
    }
  }

  dispose(): void { for (const id of [...this.bridges.keys()]) this.disconnect(id) }

  private async hello(connectionId: string): Promise<HelloResult> {
    const bridge = this.bridge(connectionId)
    try {
      const result = await bridge.client.hello() as HelloResult
      this.errors.delete(connectionId)
      return result
    } catch (error) {
      this.disconnect(connectionId)
      const message = errorMessage(error)
      this.errors.set(connectionId, message)
      throw new Error(message)
    }
  }

  private client(connectionId: string): RemoteProjectClient { return this.bridge(connectionId).client }

  private async bootstrap(connectionId: string): Promise<HelloResult> {
    const config = this.connectionConfig(connectionId)
    const archive = await packRemotePlugin()
    await runSshScript(config, buildRemoteBootstrapScript({
      socketPath: config.socketPath,
      dshPackage: this.options.remoteDshPackage,
      remotePackageArchive: archive,
    }), this.options)
    this.disconnect(connectionId)
    return this.hello(connectionId)
  }

  private createProject(connectionId: string, projectId: string, projectRoot: string): Promise<unknown> {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(projectId)) throw new Error('project id must start with a lowercase letter and contain only lowercase letters, digits, or dashes')
    if (!projectRoot.startsWith('/')) throw new Error('project root must be an absolute remote path')
    return this.client(connectionId).createProject(projectId, projectRoot)
  }

  private bridge(connectionId: string): Bridge {
    const existing = this.bridges.get(connectionId)
    if (existing !== undefined) return existing
    const config = this.connectionConfig(connectionId)
    const bridge = new Bridge(config, this.options.sshConnectTimeoutSeconds, (error) => {
      if (this.bridges.get(connectionId) !== bridge) return
      this.bridges.delete(connectionId)
      if (error !== undefined) this.errors.set(connectionId, error)
    })
    this.bridges.set(connectionId, bridge)
    return bridge
  }

  private connectionConfig(connectionId: string): RemoteConnectionConfig {
    const config = this.settings.get().connections.find(entry => entry.id === connectionId)
    if (config === undefined) throw new Error(`unknown remote connection: ${connectionId}`)
    return config
  }

  private disconnect(connectionId: string): void {
    const bridge = this.bridges.get(connectionId)
    if (bridge === undefined) return
    this.bridges.delete(connectionId)
    bridge.close()
  }
}

/** Mount the local connection registry and browser endpoints. */
export function apply(ctx: Context, config: LocalConfig = {}): void {
  const base = { connections: config.connections ?? [] }
  for (const connection of base.connections) validateConnection(connection)
  const remoteDshPackage = config.remoteDshPackage ?? DEFAULT_REMOTE_DSH_PACKAGE
  if (!OFFICIAL_DSH_PACKAGE.test(remoteDshPackage)) {
    throw new Error('remoteDshPackage must be an exact official release such as @deepseek-ai/dsh@0.1.0-rc.6')
  }
  const settings = ctx.settings.register(SETTINGS_NS, z.object({
    connections: z.array(z.object({
      id: z.string().required(), host: z.string().required(), socketPath: z.string().required(),
    })).default([]),
  }), { base })
  const manager = new LocalRemoteManager(settings, {
    remoteDshPackage,
    sshConnectTimeoutSeconds: config.sshConnectTimeoutSeconds ?? 10,
    bootstrapTimeoutMs: config.bootstrapTimeoutMs ?? 5 * 60_000,
  })
  ctx.effect(() => () => { manager.dispose() }, 'dsh-remote.local.bridges')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: API_PATH,
    handler: async (req, res) => {
      if (req.method === 'GET') {  json(res, 200, manager.state()); return }
      if (req.method !== 'POST') {  json(res, 405, { error: 'method not allowed' }); return }
      try {
        const action = await readAction(req)
        json(res, 200, { value: await manager.run(action) }); return
      } catch (error) {
        json(res, 400, { error: errorMessage(error) }); return
      }
    },
  }), 'dsh-remote.local.api')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: EVENTS_PATH,
    handler: async (req, res) => { await serveEvents(manager, req, res) },
  }), 'dsh-remote.local.events')
}

async function serveEvents(manager: LocalRemoteManager, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? EVENTS_PATH, 'http://localhost')
  const connectionId = requiredQuery(url, 'connectionId')
  const projectId = requiredQuery(url, 'projectId')
  const sessionId = requiredQuery(url, 'sessionId')
  const fromSeq = Number(url.searchParams.get('fromSeq') ?? '0')
  if (!Number.isSafeInteger(fromSeq) || fromSeq < 0) {  json(res, 400, { error: 'invalid fromSeq' }); return }
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    'connection': 'keep-alive',
  })
  const send = (event: RemoteSessionEvent): void => { res.write(`data: ${JSON.stringify(event)}\n\n`) }
  try {
    const dispose = await manager.subscribe(connectionId, projectId, sessionId, fromSeq, send)
    const heartbeat = setInterval(() => { res.write(': keepalive\n\n') }, 15_000)
    req.once('close', () => { clearInterval(heartbeat); dispose() })
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: errorMessage(error) })}\n\n`)
    res.end()
  }
}

function validateConnection(connection: RemoteConnectionConfig): void {
  if (!ID.test(connection.id)) throw new Error('connection id must start with a lowercase letter and contain only lowercase letters, digits, or dashes')
  if (!SSH_HOST.test(connection.host)) throw new Error('host must be an OpenSSH hostname or alias without command-line options')
  if (!SOCKET_PATH.test(connection.socketPath) || connection.socketPath.includes('/../')) throw new Error('socketPath must be a simple absolute remote path')
}

async function readAction(req: IncomingMessage): Promise<RemoteAction> {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (typeof value !== 'object' || value === null || typeof (value as { action?: unknown }).action !== 'string') throw new Error('invalid action')
  return value as RemoteAction
}

function requiredQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key)
  if (value === null || value === '') throw new Error(`missing ${key}`)
  return value
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }

async function runSshScript(
  config: RemoteConnectionConfig,
  script: string,
  options: Required<Pick<LocalConfig, 'sshConnectTimeoutSeconds' | 'bootstrapTimeoutMs'>>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const process = spawn('ssh', [
      '-T', '-o', 'BatchMode=yes', '-o', `ConnectTimeout=${options.sshConnectTimeoutSeconds}`,
      config.host, 'sh', '-s',
    ], { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    let settled = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      process.kill('SIGKILL')
    }, options.bootstrapTimeoutMs)
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error === undefined) resolve()
      else reject(error)
    }
    process.stderr.setEncoding('utf8')
    process.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-8192) })
    process.once('error', (error) => { finish(error) })
    process.once('exit', (code, signal) => {
      if (timedOut) finish(new Error(`remote bootstrap exceeded ${options.bootstrapTimeoutMs}ms`))
      else if (code === 0) finish()
      else finish(new Error(stderr.trim() || `remote bootstrap ssh exited (${code === null ? signal : String(code)})`))
    })
    process.stdin.end(script)
  })
}
