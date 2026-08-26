import { describe, expect, it } from 'vitest'
import { storeKeyOf, STORE_KEY } from '../src/client/history-store.ts'

describe('storeKeyOf', () => {
  it('uses the local bucket for local sessions', () => {
    expect(storeKeyOf('session-local-1')).toBe(`${STORE_KEY}@local`)
    expect(storeKeyOf(undefined)).toBe(`${STORE_KEY}@local`)
  })

  it('uses one bucket per remote authority', () => {
    expect(storeKeyOf('@authority/remote-b/session-1')).toBe(`${STORE_KEY}@remote-b`)
    expect(storeKeyOf('@authority/remote-a/session-2')).toBe(`${STORE_KEY}@remote-a`)
  })

  it('isolates authorities from each other and from local', () => {
    const local = storeKeyOf('local-s')
    const a = storeKeyOf('@authority/remote-a/s')
    const b = storeKeyOf('@authority/remote-b/s')
    expect(new Set([local, a, b]).size).toBe(3)
  })
})
