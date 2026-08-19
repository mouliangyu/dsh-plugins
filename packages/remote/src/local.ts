/** Local SSH authority manager and transparent official-API proxy. */

import { spawn } from 'node:child_process'
import { request as requestHttp } from 'node:http'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import { WebSocket, WebSocketServer } from 'ws'
import type { RawData } from 'ws'
import type { SessionRelay, SessionRelayService } from 'dsh-session-control/relay'
import type { RemoteAction, RemoteConnectionConfig, RemoteStateView, SshHostView } from './local-contract.ts'
import { discoverSshHostAliases } from './ssh-config.ts'
import { RemoteSessionRelayProvider } from './session-relay.ts'
import { openRemoteApiForward, type RemoteApiForward } from './transparent.ts'

export type * from './local-contract.ts'

export const name = 'dsh-remote'
export const inject = ['sessionRelay', 'settings', 'webServer']

const CONTROL_PATH = '/dsh-remote/control'
const AUTHORITY_PREFIX = '/dsh-remote/authority'
const MAX_BODY_BYTES = 1024 * 1024
const ID = /^[a-z][a-z0-9-]{0,63}$/
const SSH_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
const SETTINGS_NS = settingsNamespace('dsh-remote')

/** Local plugin composition defaults. */
export interface LocalConfig {
  connections?: RemoteConnectionConfig[]
  /** OpenSSH connection timeout applied to start and forwarding operations. */
  sshConnectTimeoutSeconds?: number
  /** Start saved authorities in the background when the plugin loads. */
  autoConnect?: boolean
}

export const Config: z<LocalConfig> = z.object({
  connections: z.array(z.object({
    id: z.string().required(),
    host: z.string().required(),
    remotePort: z.number().min(1).max(65535).default(3090),
  })).default([]),
  sshConnectTimeoutSeconds: z.number().min(1).max(120).default(10),
  autoConnect: z.boolean().default(true),
})

class RemoteAuthorityManager {
  private readonly forwards = new Map<string, RemoteApiForward>()
  private readonly errors = new Map<string, string>()
  private readonly relayErrors = new Map<string, string>()
  private readonly upgradeDisposers = new Map<string, () => void>()
  private readonly relayProviders = new Map<string, RemoteSessionRelayProvider>()
  private readonly relayDisposers = new Map<string, () => void>()

  constructor(
    private readonly settings: SettingsScope<{ connections: RemoteConnectionConfig[] }>,
    private readonly webServer: WebServer,
    private readonly connectTimeoutSeconds: number,
    private readonly sessionRelay: SessionRelayService,
  ) {
    for (const connection of settings.get().connections) this.registerUpgrades(connection.id)
  }

  state(): RemoteStateView {
    return { connections: this.settings.get().connections.map((connection) => ({
      ...connection,
      connected: this.forwards.has(connection.id),
      relayConnected: this.relayProviders.has(connection.id),
      basePath: authorityBasePath(connection.id),
      ...(this.errors.has(connection.id) ? { error: this.errors.get(connection.id) } : {}),
      ...(this.relayErrors.has(connection.id) ? { relayError: this.relayErrors.get(connection.id) } : {}),
    })) }
  }

  async run(action: RemoteAction): Promise<unknown> {
    switch (action.action) {
      case 'discoverHosts':
        return { hosts: (await discoverSshHostAliases()).map<SshHostView>(alias => ({ alias })) }
      case 'saveConnection': {
        validateConnection(action.connection)
        await this.disconnect(action.connection.id)
        const current = this.settings.get().connections
        const next = [...current.filter(entry => entry.id !== action.connection.id), action.connection]
        await this.settings.replace({ connections: next })
        this.registerUpgrades(action.connection.id)
        return this.state()
      }
      case 'removeConnection': {
        await this.disconnect(action.connectionId)
        this.upgradeDisposers.get(action.connectionId)?.()
        this.upgradeDisposers.delete(action.connectionId)
        await this.settings.replace({
          connections: this.settings.get().connections.filter(entry => entry.id !== action.connectionId),
        })
        return this.state()
      }
      case 'connect':
        await this.connect(action.connectionId)
        return this.state()
      case 'restart':
        await this.restart(action.connectionId)
        return this.state()
      case 'disconnect':
        await this.disconnect(action.connectionId)
        return this.state()
    }
  }

  async connect(connectionId: string): Promise<void> {
    if (this.forwards.has(connectionId)) return
    const config = this.connectionConfig(connectionId)
    let forward: RemoteApiForward | undefined
    try {
      await ensureRemoteWebHost(config, this.connectTimeoutSeconds)
      forward = await openRemoteApiForward({
        host: config.host,
        remotePort: config.remotePort,
        connectTimeoutSeconds: this.connectTimeoutSeconds,
      })
      await waitForTcp(forward.localPort, this.connectTimeoutSeconds * 1000)
      this.forwards.set(connectionId, forward)
      try {
        let provider: RemoteSessionRelayProvider | undefined
        provider = await RemoteSessionRelayProvider.connect({
          authorityId: connectionId,
          peerId: `host:${connectionId}`,
          forward,
          requestTimeoutMs: this.connectTimeoutSeconds * 1000,
          receive: message => this.receiveRelay(connectionId, message),
          listSessions: () => this.sessionRelay.listLocalSessions(),
          closed: error => {
            if (provider !== undefined) this.relayClosed(connectionId, provider, error)
          },
        })
        this.relayProviders.set(connectionId, provider)
        this.relayDisposers.set(connectionId, this.sessionRelay.registerProvider(provider))
        this.relayErrors.delete(connectionId)
      } catch (error) {
        this.relayErrors.set(connectionId, relayUnavailableMessage(error))
      }
      this.errors.delete(connectionId)
      forward.process.once('exit', (code, signal) => {
        if (this.forwards.get(connectionId) !== forward) return
        this.forwards.delete(connectionId)
        void this.closeRelay(connectionId)
        this.errors.set(connectionId, `ssh forward exited (${code === null ? signal : String(code)})`)
      })
    } catch (error) {
      this.forwards.delete(connectionId)
      await this.closeRelay(connectionId)
      await forward?.close().catch(() => undefined)
      const message = errorMessage(error)
      this.errors.set(connectionId, message)
      throw new Error(message)
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const forward = this.forwards.get(connectionId)
    if (forward === undefined) return
    this.forwards.delete(connectionId)
    await this.closeRelay(connectionId)
    await forward.close()
  }

  /** Restart the DSH Web process owned by this plugin before reconnecting. */
  async restart(connectionId: string): Promise<void> {
    await this.disconnect(connectionId)
    const config = this.connectionConfig(connectionId)
    try {
      await ensureRemoteWebHost(config, this.connectTimeoutSeconds, true)
      this.errors.delete(connectionId)
    } catch (error) {
      const message = errorMessage(error)
      this.errors.set(connectionId, message)
      throw new Error(message)
    }
  }

  proxyHttp(connectionId: string, req: IncomingMessage, res: ServerResponse): void {
    const forward = this.forwards.get(connectionId)
    if (forward === undefined) { json(res, 503, { error: `remote authority is not connected: ${connectionId}` }); return }
    const upstreamPath = upstreamApiPath(connectionId, req.url)
    if (upstreamPath === undefined) { json(res, 404, { error: 'unknown remote API path' }); return }
    const upstream = requestHttp({
      host: '127.0.0.1',
      port: forward.localPort,
      method: req.method,
      path: upstreamPath,
      headers: upstreamHeaders(req.headers, forward.localPort),
    }, (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(res)
    })
    upstream.once('error', error => { if (!res.headersSent) json(res, 502, { error: error.message }); else res.destroy(error) })
    req.pipe(upstream)
  }

  proxyUpgrade(connectionId: string, apiPath: string, req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const forward = this.forwards.get(connectionId)
    if (forward === undefined) { rejectUpgrade(socket, 503, 'remote authority is not connected'); return }
    const upstream = new WebSocket(`ws://127.0.0.1:${String(forward.localPort)}${apiPath}`, {
      headers: upstreamHeaders(req.headers, forward.localPort),
    })
    const server = new WebSocketServer({ noServer: true })
    let accepted = false
    const fail = (error: Error): void => {
      if (!accepted) rejectUpgrade(socket, 502, error.message)
      upstream.close()
      server.close()
    }
    upstream.once('error', fail)
    upstream.once('open', () => {
      server.handleUpgrade(req, socket, head, (downstream) => {
        accepted = true
        downstream.on('message', (data, isBinary) => { relayWebSocketMessage(upstream, data, isBinary) })
        upstream.on('message', (data, isBinary) => { relayWebSocketMessage(downstream, data, isBinary) })
        downstream.once('close', () => { upstream.close(); server.close() })
        upstream.once('close', () => { downstream.close(); server.close() })
      })
    })
  }

  async dispose(): Promise<void> {
    await Promise.all([...this.forwards.keys()].map(id => this.disconnect(id)))
    for (const dispose of this.upgradeDisposers.values()) dispose()
    this.upgradeDisposers.clear()
  }

  private async closeRelay(connectionId: string): Promise<void> {
    this.relayDisposers.get(connectionId)?.()
    this.relayDisposers.delete(connectionId)
    const provider = this.relayProviders.get(connectionId)
    this.relayProviders.delete(connectionId)
    await provider?.close()
  }

  private relayClosed(connectionId: string, provider: RemoteSessionRelayProvider, error: Error): void {
    if (this.relayProviders.get(connectionId) !== provider) return
    this.relayDisposers.get(connectionId)?.()
    this.relayDisposers.delete(connectionId)
    this.relayProviders.delete(connectionId)
    this.relayErrors.set(connectionId, relayUnavailableMessage(error))
  }

  private async receiveRelay(connectionId: string, message: SessionRelay): Promise<void> {
    await this.sessionRelay.receive({
      ...message,
      from: { authorityId: message.from.authorityId === 'local' ? connectionId : message.from.authorityId, sessionId: message.from.sessionId },
      to: { authorityId: 'local', sessionId: message.to.sessionId },
    })
  }

  private connectionConfig(connectionId: string): RemoteConnectionConfig {
    const config = this.settings.get().connections.find(entry => entry.id === connectionId)
    if (config === undefined) throw new Error(`unknown remote connection: ${connectionId}`)
    return config
  }

  private registerUpgrades(connectionId: string): void {
    if (this.upgradeDisposers.has(connectionId)) return
    const disposers = ['/api/events.mux', '/api/events.host'].map(apiPath => this.webServer.registerUpgrade({
      path: `${authorityBasePath(connectionId)}${apiPath}`,
      handler: (req, socket, head) => { this.proxyUpgrade(connectionId, apiPath, req, socket, head) },
    }))
    this.upgradeDisposers.set(connectionId, () => { for (const dispose of disposers) dispose() })
  }
}

/** Mount the local connection registry and transparent proxy routes. */
export function apply(ctx: Context, config: LocalConfig = {}): void {
  const base = { connections: config.connections ?? [] }
  for (const connection of base.connections) validateConnection(connection)
  const settings = ctx.settings.register(SETTINGS_NS, z.object({
    connections: z.array(z.object({
      id: z.string().required(),
      host: z.string().required(),
      remotePort: z.number().min(1).max(65535).default(3090),
    })).default([]),
  }), { base })
  const manager = new RemoteAuthorityManager(
    settings,
    ctx.webServer,
    config.sshConnectTimeoutSeconds ?? 10,
    ctx.get('sessionRelay') as SessionRelayService,
  )
  ctx.effect(() => () => manager.dispose(), 'dsh-remote.authorities')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: CONTROL_PATH,
    handler: async (req, res) => {
      if (req.method === 'GET') { json(res, 200, manager.state()); return }
      if (req.method !== 'POST') { json(res, 405, { error: 'method not allowed' }); return }
      try { json(res, 200, { value: await manager.run(await readAction(req)) }) }
      catch (error) { json(res, 400, { error: errorMessage(error) }) }
    },
  }), 'dsh-remote.control')
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: AUTHORITY_PREFIX,
    handler: (req, res) => {
      const connectionId = authorityIdFromRequest(req.url)
      if (connectionId === undefined) { json(res, 404, { error: 'unknown remote authority path' }); return }
      manager.proxyHttp(connectionId, req, res)
    },
  }), 'dsh-remote.proxy')
  if (config.autoConnect ?? true) {
    for (const connection of settings.get().connections) {
      void manager.connect(connection.id).catch(() => undefined)
    }
  }
}

function authorityBasePath(id: string): string { return `${AUTHORITY_PREFIX}/${encodeURIComponent(id)}` }

function authorityIdFromRequest(rawUrl: string | undefined): string | undefined {
  const pathname = new URL(rawUrl ?? '/', 'http://localhost').pathname
  const prefix = `${AUTHORITY_PREFIX}/`
  if (!pathname.startsWith(prefix)) return undefined
  const encoded = pathname.slice(prefix.length).split('/', 1)[0]
  if (encoded === undefined || encoded === '') return undefined
  return decodeURIComponent(encoded)
}

function upstreamApiPath(connectionId: string, rawUrl: string | undefined): string | undefined {
  const url = new URL(rawUrl ?? '/', 'http://localhost')
  const prefix = authorityBasePath(connectionId)
  if (!url.pathname.startsWith(`${prefix}/api/`)) return undefined
  return `${url.pathname.slice(prefix.length)}${url.search}`
}

function upstreamHeaders(headers: IncomingHttpHeaders, port: number): IncomingHttpHeaders {
  const authority = `127.0.0.1:${String(port)}`
  return { ...headers, host: authority, origin: `http://${authority}`, 'sec-fetch-site': 'same-origin' }
}

function validateConnection(connection: RemoteConnectionConfig): void {
  if (!ID.test(connection.id)) throw new Error('connection id must start with a lowercase letter and contain only lowercase letters, digits, or dashes')
  if (!SSH_HOST.test(connection.host)) throw new Error('host must be an OpenSSH hostname or alias without command-line options')
  if (!Number.isSafeInteger(connection.remotePort) || connection.remotePort < 1 || connection.remotePort > 65535) {
    throw new Error('remote port must be between 1 and 65535')
  }
}

async function ensureRemoteWebHost(config: RemoteConnectionConfig, timeoutSeconds: number, restart = false): Promise<void> {
  const script = `set -eu
command -v dsh >/dev/null 2>&1 || { echo 'official dsh CLI is not installed on the remote host' >&2; exit 127; }
port=${String(config.remotePort)}
probe() { "$(command -v node)" -e "const n=require('node:net');const s=n.connect({host:'127.0.0.1',port:Number(process.argv[1])},()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),500)" "$port"; }
${restart ? `
dsh_home="\${DSH_HOME:-$HOME/.dsh}"
pid_file="$dsh_home/remote-web.pid"
if test -f "$pid_file"; then
  pid="$(cat "$pid_file")"
  case "$pid" in (*[!0-9]*|'') echo 'remote DSH PID file is invalid' >&2; exit 1;; esac
  if kill -0 "$pid" 2>/dev/null; then
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    case "$command" in (*dsh*--profile*web*) kill "$pid";; (*) echo 'remote DSH PID file does not identify a DSH Web process' >&2; exit 1;; esac
    attempt=0
    while kill -0 "$pid" 2>/dev/null && test "$attempt" -lt 40; do attempt=$((attempt + 1)); sleep 0.25; done
    if kill -0 "$pid" 2>/dev/null; then echo 'remote DSH Web process did not stop' >&2; exit 1; fi
  fi
  rm -f "$pid_file"
fi
if probe; then echo 'remote DSH port is still occupied after stopping the owned process' >&2; exit 1; fi
` : ''}
if probe; then exit 0; fi
dsh_home="\${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$dsh_home"
nohup dsh --profile web --host 127.0.0.1 --port "$port" >> "$dsh_home/remote-web.log" 2>&1 </dev/null &
echo "$!" > "$dsh_home/remote-web.pid"
attempt=0
while test "$attempt" -lt 60; do
  if probe; then exit 0; fi
  attempt=$((attempt + 1))
  sleep 0.25
done
tail -n 40 "$dsh_home/remote-web.log" >&2 || true
exit 1`
  await runSshScript(config.host, script, timeoutSeconds * 1000 + 20_000)
}

async function runSshScript(host: string, script: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ssh', ['-T', '-o', 'BatchMode=yes', host, 'sh', '-s'], { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('remote DSH startup timed out')) }, timeoutMs)
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-8192) })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `ssh exited (${code === null ? signal : String(code)})`))
    })
    child.stdin.end(script)
  })
}

async function waitForTcp(port: number, timeoutMs: number): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const req = requestHttp({ host: '127.0.0.1', port, method: 'HEAD', path: '/' })
      req.once('response', response => { response.resume(); resolve(true) })
      req.once('error', () => { resolve(false) })
      req.end()
    })
    if (connected) return
    await new Promise(resolve => { setTimeout(resolve, 100) })
  }
  throw new Error('SSH forward did not reach the remote DSH Web Host')
}

async function readAction(req: IncomingMessage): Promise<RemoteAction> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as RemoteAction
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  if (!socket.destroyed) socket.end(`HTTP/1.1 ${String(status)} Bad Gateway\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${message}`)
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error) }

function relayUnavailableMessage(error: unknown): string {
  const detail = errorMessage(error)
  return `session relay unavailable; install dsh-session-control and dsh-remote in the remote Web profile${detail === '' ? '' : ` (${detail})`}`
}

/** Forward one WebSocket message without changing its text/binary opcode. */
export function relayWebSocketMessage(
  target: Pick<WebSocket, 'readyState' | 'send'>,
  data: RawData,
  isBinary: boolean,
): void {
  if (target.readyState === WebSocket.OPEN) target.send(data, { binary: isBinary })
}
