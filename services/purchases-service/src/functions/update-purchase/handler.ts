import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json, requiredPath } from '@cloud-learning/aws-clients'
import { parseBody, purchaseStatusSchema } from '@cloud-learning/validation'
import { updatePurchaseStatus } from '../../application/purchase-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { status, userId } = parseBody(purchaseStatusSchema, event.body)
    return json(200, await updatePurchaseStatus(claimsFrom(event), requiredPath(event, 'purchaseId'), status, userId))
  } catch (error) { return handleError(error) }
}
