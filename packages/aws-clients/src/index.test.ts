import { describe, expect, it } from 'vitest'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { claimsFrom, decodeNextToken, encodeNextToken } from './index.js'

function eventWith(authorizer: Record<string, unknown>): APIGatewayProxyEvent {
  return { requestContext: { authorizer } } as unknown as APIGatewayProxyEvent
}

describe('claimsFrom', () => {
  const expected = { userId: 'user-1', tenantId: 'tenant-a', role: 'admin', email: 'admin@example.test' }
  const claims = { sub: 'user-1', 'custom:tenant_id': 'tenant-a', 'custom:role': 'admin', email: 'admin@example.test' }

  it('reads the nested shape produced by Cognito', () => {
    expect(claimsFrom(eventWith({ claims }))).toEqual(expected)
  })

  it('accepts serialized Cognito claims defensively', () => {
    expect(claimsFrom(eventWith({ claims: JSON.stringify(claims) }))).toEqual(expected)
  })

  it('rejects roles and tenant identifiers outside the trusted contract', () => {
    expect(() => claimsFrom(eventWith({ claims: { ...claims, 'custom:role': 'platform-admin' } })))
      .toThrowError(expect.objectContaining({ statusCode: 401 }))
    expect(() => claimsFrom(eventWith({ claims: { ...claims, 'custom:tenant_id': '../tenant-a' } })))
      .toThrowError(expect.objectContaining({ statusCode: 401 }))
  })
})

describe('pagination cursors', () => {
  it('accepts a cursor only for the expected tenant', () => {
    const token = encodeNextToken({ tenantId: 'tenant-a', courseId: 'course-1' })
    expect(decodeNextToken(token, { tenantId: 'tenant-a' })).toEqual({ tenantId: 'tenant-a', courseId: 'course-1' })
    expect(() => decodeNextToken(token, { tenantId: 'tenant-b' })).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects non-object cursors', () => {
    const token = Buffer.from(JSON.stringify(['tenant-a'])).toString('base64url')
    expect(() => decodeNextToken(token)).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })
})
