/** Browser coordinator for SSH-backed official DSH authorities. */

import type {
  AuthorityConnection, AuthorityProvider, AuthorityRegistry, AuthorityState,
} from '@deepseek-ai/dsh-client-connection/client'
import { RemoteWebApiClient } from './remote-web-api-client.ts'
import type { RemoteAction, RemoteConnectionConfig, RemoteStateView, SshHostView } from '../local-contract.ts'

const CONTROL_PATH = '/dsh-remote/control'

async function request<T>(action?: RemoteAction): Promise<T> {
  const response = await fetch(CONTROL_PATH, action === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action),
  })
  const payload = await response.json() as { value?: T; error?: string }
  if (!response.ok || payload.error !== undefined) throw new Error(payload.error ?? `HTTP ${response.status}`)
  return (action === undefined ? payload : payload.value) as T
}

class RemoteAuthorityConnection implements AuthorityConnection {
  readonly api: AuthorityConnection['api']
  state: AuthorityState = 'ready'
  private readonly listeners = new Set<(state: AuthorityState) => void>()

  constructor(basePath: string, private readonly closeTransport: () => Promise<void>) {
    this.api = new RemoteWebApiClient(new URL(basePath, location.origin).href)
  }

  subscribe(listener: (state: AuthorityState) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  publish(state: AuthorityState): void {
    if (this.state === state) return
    this.state = state
    for (const listener of this.listeners) listener(state)
  }

  async close(): Promise<void> {
    this.publish('closed')
    await this.closeTransport()
  }
}

/** Remote connection settings and core authority registrations. */
export class RemoteAuthorityCoordinator {
  private snapshot: RemoteStateView = { connections: [] }
  private readonly listeners = new Set<() => void>()
  private readonly providerDisposers = new Map<string, () => Promise<void>>()
  private readonly liveConnections = new Map<string, RemoteAuthorityConnection>()
  private disposed = false

  constructor(private readonly registry: AuthorityRegistry) {}

  getSnapshot = (): RemoteStateView => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async start(): Promise<void> { await this.refresh() }
  async refresh(): Promise<void> { await this.reconcile(await request<RemoteStateView>()) }
  async discoverHosts(): Promise<SshHostView[]> {
    return (await request<{ hosts: SshHostView[] }>({ action: 'discoverHosts' })).hosts
  }
  async save(connection: RemoteConnectionConfig): Promise<void> {
    await this.reconcile(await request<RemoteStateView>({ action: 'saveConnection', connection }))
  }
  async remove(connectionId: string): Promise<void> {
    await this.registry.disconnect(connectionId)
    await this.reconcile(await request<RemoteStateView>({ action: 'removeConnection', connectionId }))
  }
  async connect(connectionId: string): Promise<void> {
    await this.registry.connect(connectionId)
    await this.refresh()
  }
  async disconnect(connectionId: string): Promise<void> {
    await this.registry.disconnect(connectionId)
    await this.refresh()
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await Promise.all([...this.providerDisposers.values()].map(dispose => dispose()))
    this.providerDisposers.clear()
    this.liveConnections.clear()
  }

  private async reconcile(state: RemoteStateView): Promise<void> {
    if (this.disposed) return
    const currentIds = new Set(state.connections.map(connection => connection.id))
    for (const [id, dispose] of this.providerDisposers) {
      if (currentIds.has(id)) continue
      this.providerDisposers.delete(id)
      this.liveConnections.delete(id)
      await dispose()
    }
    for (const connection of state.connections) {
      if (!this.providerDisposers.has(connection.id)) {
        const provider: AuthorityProvider = {
          id: connection.id,
          kind: 'ssh',
          connect: async () => {
            const next = await request<RemoteStateView>({ action: 'connect', connectionId: connection.id })
            const row = next.connections.find(item => item.id === connection.id)
            if (row === undefined || !row.connected) throw new Error(row?.error ?? `remote authority did not connect: ${connection.id}`)
            const authority = new RemoteAuthorityConnection(row.basePath, async () => {
              await request<RemoteStateView>({ action: 'disconnect', connectionId: connection.id })
            })
            this.liveConnections.set(connection.id, authority)
            return authority
          },
        }
        this.providerDisposers.set(connection.id, this.registry.register(provider))
      }
      this.liveConnections.get(connection.id)?.publish(connection.connected ? 'ready' : 'failed')
      if (connection.connected && this.registry.get(connection.id) === undefined) {
        void this.registry.connect(connection.id).catch(() => undefined)
      }
    }
    this.snapshot = state
    for (const listener of this.listeners) listener()
  }
}
