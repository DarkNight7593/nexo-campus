import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { Client } from '@opensearch-project/opensearch'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import type { AuthClaims, UserRole } from '@cloud-learning/contracts'
import { ZodError } from 'zod'

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1'
const allowedRoles = new Set<UserRole>(['admin', 'instructor', 'student'])
const tenantIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true }
})

export const s3 = new S3Client({ region })

export function createOpenSearchClient(endpoint = process.env.OPENSEARCH_ENDPOINT): Client {
  if (!endpoint) throw new Error('OPENSEARCH_ENDPOINT is not configured')
  return new Client({
    ...AwsSigv4Signer({
      region,
      service: 'aoss',
      getCredentials: defaultProvider()
    }),
    node: endpoint
  })
}

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': process.env.CORS_ALLOWED_ORIGIN ?? '',
      'Vary': 'Origin'
    },
    body: statusCode === 204 ? '' : JSON.stringify(body)
  }
}

export function claimsFrom(event: APIGatewayProxyEvent): AuthClaims {
  const authorizer = event.requestContext.authorizer
  const rawClaims = authorizer?.claims
  let claims: Record<string, string> | undefined
  try {
    claims = (typeof rawClaims === 'string'
      ? JSON.parse(rawClaims)
      : rawClaims) as Record<string, string> | undefined
  } catch {
    throw new HttpError(401, 'Invalid authenticated claims')
  }
  const userId = claims?.sub
  const tenantId = claims?.['custom:tenant_id']
  const rawRole = claims?.['custom:role']
  const role = typeof rawRole === 'string' && allowedRoles.has(rawRole as UserRole) ? rawRole as UserRole : undefined
  if (!userId || userId.length > 128 || !tenantId || !tenantIdPattern.test(tenantId) || !role) {
    console.warn('Authenticated request is missing claims', {
      authorizerKeys: Object.keys(authorizer ?? {}),
      claimsType: typeof rawClaims
    })
    throw new HttpError(401, 'The authenticated token is missing user, tenant or role claims')
  }
  const email = typeof claims?.email === 'string' && claims.email.length <= 320 ? claims.email : undefined
  return { userId, tenantId, role, email }
}

export function requireRole(claims: AuthClaims, ...allowed: UserRole[]): void {
  if (!allowed.includes(claims.role)) throw new HttpError(403, 'Insufficient permissions')
}

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
  }
}

export function handleError(error: unknown): APIGatewayProxyResult {
  if (error instanceof HttpError) return json(error.statusCode, { message: error.message })
  if (error instanceof ZodError) return json(400, { message: 'Invalid request', issues: error.issues })
  if (error instanceof SyntaxError) return json(400, { message: 'Invalid JSON body' })
  const failure = error instanceof Error ? error : new Error(String(error))
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    service: process.env.SERVICE_NAME ?? 'unknown',
    stage: process.env.APP_STAGE ?? 'unknown',
    message: 'Unhandled request failure',
    errorName: failure.name,
    errorMessage: failure.message
  }))
  return json(500, { message: 'Internal server error' })
}

export function requiredPath(event: APIGatewayProxyEvent, name: string): string {
  const value = event.pathParameters?.[name]
  if (!value) throw new HttpError(400, `Missing path parameter: ${name}`)
  if (value.length > 128) throw new HttpError(400, `Invalid path parameter: ${name}`)
  return value
}

export function encodeNextToken(value: Record<string, unknown> | undefined): string | undefined {
  return value ? Buffer.from(JSON.stringify(value)).toString('base64url') : undefined
}

export function decodeNextToken(value: string | undefined, expected: Record<string, string> = {}): Record<string, unknown> | undefined {
  if (!value) return undefined
  if (value.length > 4096) throw new HttpError(400, 'Invalid nextToken')
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Cursor is not an object')
    const cursor = decoded as Record<string, unknown>
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (cursor[key] !== expectedValue) throw new Error(`Cursor does not match ${key}`)
    }
    return cursor
  } catch {
    throw new HttpError(400, 'Invalid nextToken')
  }
}
