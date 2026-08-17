import { describe, expect, it, vi } from 'vitest'
import type { IApiClient, RpcRequest, MuxFrame } from '@deepseek-ai/dsh-api-remotes/client'
import { AuthorityApiRouter, authorityId } from '../src/client/authority-router.ts'
import type { AuthorityRegistryLike } from '../src/client/authority-types.ts'

function api(overrides: Partial<IApiClient>): IApiClient {
  return overrides as IApiClient
}

function registry(remote: IApiClient): AuthorityRegistryLike {
  return {
    getSnapshot: () => ({ ids: ['remote-a'], states: { 'remote-a': 'ready' } }),
    subscribe: () => () => undefined,
    get: id => id === 'remote-a' ? { api: remote, state: 'ready', subscribe: () => () => undefined, close: async () => undefined } : undefined,
    register: () => async () => undefined,
    connect: async () => { throw new Error('unused') },
    disconnect: async () => undefined,
  }
}

describe('AuthorityApiRouter', () => {
  it('routes session-scoped calls with raw wire ids', async () => {
    const localModels = vi.fn()
    const remoteModels = vi.fn(async () => ({ rpcId: 'remote', result: { ok: true, value: { current: {}, groups: [], failures: [], routable: true } } }))
    const router = new AuthorityApiRouter(
      api({ sessions: { models: localModels } as never }),
      registry(api({ sessions: { models: remoteModels } as never })),
    )

    await router.api.sessions.models({ sessionId: authorityId('remote-a', 'session-1') as never })

    expect(localModels).not.toHaveBeenCalled()
    expect(remoteModels).toHaveBeenCalledWith({ sessionId: 'session-1' }, undefined)
  })

  it('namespaces remote list results and routes responses by frame rpcId', async () => {
    const localList = vi.fn(async () => ({ rpcId: 'local', result: { ok: true, value: { items: [] } } }))
    const remoteList = vi.fn(async () => ({ rpcId: 'remote', result: { ok: true, value: { items: [{ sessionId: 'session-1' }] } } }))
    const localRespond = vi.fn()
    const remoteRespond = vi.fn(async () => ({ accepted: true }))
    const remote = api({ sessions: { list: remoteList } as never, respond: remoteRespond })
    const router = new AuthorityApiRouter(
      api({ sessions: { list: localList } as never, respond: localRespond }),
      registry(remote),
    )

    const listed = await router.api.sessions.list({})
    router.transformMux('remote-a', {
      rpcId: 'question-1',
      payload: { type: 'question/requested', sessionId: 'session-1', questions: [] },
    } as unknown as RpcRequest<MuxFrame>)
    await router.api.respond({ type: 'client-response', rpcId: 'question-1', result: { ok: true, value: {} } } as never)

    expect(listed.result).toEqual({ ok: true, value: { items: [{ sessionId: authorityId('remote-a', 'session-1') }] } })
    expect(remoteRespond).toHaveBeenCalledOnce()
    expect(localRespond).not.toHaveBeenCalled()
  })
})
