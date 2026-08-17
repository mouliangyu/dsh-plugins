/** Browser carrier for an official DSH API reached through an SSH forward. */

import type { ApiProxy, HostFrame, MuxFrame, RpcRequest, ServerRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { AbstractApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'
import { hostFrameSchema, muxFrameSchema } from '@deepseek-ai/dsh-host-apiproxy/api/events.schema'
import { serverRequestSchema } from '@deepseek-ai/dsh-host-apiproxy/api/rpc.schema'

type SocketItem<F> = { kind: 'frame'; envelope: RpcRequest<F> } | { kind: 'end' }
type Parser<F> = { parse(value: unknown): F }

/** Official API carrier with provider-owned event downlink reconnection. */
export class RemoteWebApiClient extends AbstractApiClient {
  private readonly base: URL

  /**
   * @param baseUrl - same-origin path of the SSH-forwarded official Web Host.
   * @param reconnectDelayMs - delay before reopening a lost event downlink.
   */
  constructor(baseUrl: string, private readonly reconnectDelayMs = 750) {
    super()
    this.base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  }

  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(this.resolveRemote(input.pathname + input.search), init)
  }

  protected override openMux(_payload: Parameters<ApiProxy['events']['mux']>[0]['payload'], signal: AbortSignal, onOpen?: () => void): AsyncIterable<RpcRequest<MuxFrame>> {
    return this.readWebSocket('/api/events.mux', signal, muxFrameSchema, onOpen)
  }

  protected override openHost(_payload: Parameters<ApiProxy['events']['host']>[0]['payload'], signal: AbortSignal, onOpen?: () => void): AsyncIterable<RpcRequest<HostFrame>> {
    return this.readWebSocket('/api/events.host', signal, hostFrameSchema, onOpen)
  }

  private async *readWebSocket<F>(path: string, signal: AbortSignal, schema: Parser<F>, onOpen?: () => void): AsyncGenerator<RpcRequest<F>> {
    while (!signal.aborted) {
      yield* this.readWebSocketGeneration(path, signal, schema, onOpen)
      if (!signal.aborted) await wait(this.reconnectDelayMs, signal)
    }
  }

  private async *readWebSocketGeneration<F>(path: string, signal: AbortSignal, schema: Parser<F>, onOpen?: () => void): AsyncGenerator<RpcRequest<F>> {
    const url = this.resolveRemote(path)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(url)
    const inbox: SocketItem<F>[] = []
    let wake: (() => void) | undefined
    const enqueue = (item: SocketItem<F>): void => { inbox.push(item); wake?.(); wake = undefined }
    const handleMessage = (event: MessageEvent): void => {
      try {
        if (typeof event.data !== 'string') throw new Error('binary WebSocket frame')
        const full = serverRequestSchema.parse(JSON.parse(event.data)) as ServerRequest
        this.onEnvelope(full)
        enqueue({ kind: 'frame', envelope: { rpcId: full.rpcId, payload: schema.parse(full.payload) } })
      } catch (error) { console.error('[dsh-remote] dropping malformed official API frame:', error) }
    }
    const handleAbort = (): void => {
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close()
    }
    socket.addEventListener('open', () => { onOpen?.() })
    socket.addEventListener('message', handleMessage)
    socket.addEventListener('close', () => { enqueue({ kind: 'end' }) }, { once: true })
    socket.addEventListener('error', () => { enqueue({ kind: 'end' }) }, { once: true })
    signal.addEventListener('abort', handleAbort, { once: true })
    if (signal.aborted) handleAbort()
    try {
      while (true) {
        while (inbox.length > 0) {
          const item = inbox.shift() as SocketItem<F>
          if (item.kind === 'end') return
          yield item.envelope
        }
        await new Promise<void>(resolve => { wake = resolve })
      }
    } finally {
      signal.removeEventListener('abort', handleAbort)
      socket.removeEventListener('message', handleMessage)
      handleAbort()
    }
  }

  private resolveRemote(path: string): URL { return new URL(path.replace(/^\//, ''), this.base) }
}

async function wait(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done(): void { clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
  })
}
