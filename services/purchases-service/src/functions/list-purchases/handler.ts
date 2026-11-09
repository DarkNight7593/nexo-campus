import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { readPurchases } from '../../application/purchase-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try { return json(200, { items: await readPurchases(claimsFrom(event)) }) }
  catch (error) { return handleError(error) }
}
