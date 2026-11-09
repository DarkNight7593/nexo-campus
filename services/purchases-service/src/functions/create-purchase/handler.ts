import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, HttpError, json } from '@cloud-learning/aws-clients'
import { parseBody, purchaseSchema } from '@cloud-learning/validation'
import { createPurchase } from '../../application/purchase-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const idempotencyKey = Object.entries(event.headers ?? {}).find(([name]) => name.toLowerCase() === 'idempotency-key')?.[1]
    if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new HttpError(400, 'Idempotency-Key must be a UUID v4')
    }
    return json(201, await createPurchase(claimsFrom(event), parseBody(purchaseSchema, event.body), idempotencyKey))
  }
  catch (error) { return handleError(error) }
}
