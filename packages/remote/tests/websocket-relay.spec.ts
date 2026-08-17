import { describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { relayWebSocketMessage } from '../src/local.ts'

describe('relayWebSocketMessage', () => {
  it('preserves the upstream WebSocket opcode', () => {
    const send = vi.fn()
    const target = { readyState: WebSocket.OPEN, send } as unknown as Pick<WebSocket, 'readyState' | 'send'>
    const data = Buffer.from('{"type":"server-request"}')

    relayWebSocketMessage(target, data, false)
    relayWebSocketMessage(target, data, true)

    expect(send).toHaveBeenNthCalledWith(1, data, { binary: false })
    expect(send).toHaveBeenNthCalledWith(2, data, { binary: true })
  })

  it('drops messages after the target closes', () => {
    const send = vi.fn()
    const target = { readyState: WebSocket.CLOSED, send } as unknown as Pick<WebSocket, 'readyState' | 'send'>

    relayWebSocketMessage(target, Buffer.from('late'), false)

    expect(send).not.toHaveBeenCalled()
  })
})
