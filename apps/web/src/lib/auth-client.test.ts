import { beforeEach, describe, expect, it, vi } from 'vitest'
import { idToken, tokenClaims } from './auth-client.js'

const values = new Map<string, string>()

function token(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${encoded}.signature`
}

beforeEach(() => {
  values.clear()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear()
  })
})

describe('browser token handling', () => {
  it('returns claims for a non-expired ID token', () => {
    values.set('cl_id_token', token({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 }))
    expect(tokenClaims()?.sub).toBe('user-1')
  })

  it('removes an expired session', () => {
    values.set('cl_id_token', token({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 1 }))
    values.set('cl_access_token', 'access-token')
    expect(idToken()).toBeNull()
    expect(values.has('cl_id_token')).toBe(false)
    expect(values.has('cl_access_token')).toBe(false)
  })

  it('rejects a malformed token', () => {
    values.set('cl_id_token', 'not-a-jwt')
    expect(idToken()).toBeNull()
  })
})
