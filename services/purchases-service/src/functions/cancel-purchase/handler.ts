import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json, requiredPath } from '@cloud-learning/aws-clients'
import { cancelPurchase } from '../../application/purchase-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try { return json(200, await cancelPurchase(claimsFrom(event), requiredPath(event, 'purchaseId'))) }
  catch (error) { return handleError(error) }
}
