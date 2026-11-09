import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { readOrganizations } from '../../application/organization-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    return json(200, { items: await readOrganizations(claimsFrom(event)) })
  } catch (error) {
    return handleError(error)
  }
}
