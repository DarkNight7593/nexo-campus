import type { APIGatewayProxyEvent } from 'aws-lambda'

export function apiEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/',
    requestContext: {
      accountId: '123456789012',
      apiId: 'test',
      authorizer: {
        claims: {
          sub: 'user-1',
          'custom:tenant_id': 'tenant-1',
          'custom:role': 'admin'
        }
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {} as APIGatewayProxyEvent['requestContext']['identity'],
      path: '/',
      stage: 'test',
      requestId: 'request-1',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource',
      resourcePath: '/'
    },
    ...overrides
  }
}
