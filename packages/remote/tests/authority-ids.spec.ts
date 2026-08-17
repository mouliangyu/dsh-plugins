import { describe, expect, it } from 'vitest'
import { authorityId, authorityOf, parseAuthorityId } from '../../client-runtime-remote/src/client/authority-router.ts'

describe('authority ids', () => {
  it('isolates remote ids while preserving their exact wire value', () => {
    const id = authorityId('remote/a', 'session / one')
    expect(id).toBe('@authority/remote%2Fa/session%20%2F%20one')
    expect(parseAuthorityId(id)).toEqual({ authorityId: 'remote/a', remoteId: 'session / one' })
    expect(authorityOf(id)).toBe('remote/a')
    expect(parseAuthorityId('local-session')).toBeUndefined()
  })
})
