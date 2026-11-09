import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json, requiredPath } from '@cloud-learning/aws-clients'
import { readOrganization } from '../../application/organization-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    return json(200, await readOrganization(claimsFrom(event), requiredPath(event, 'organizationId')))
  } catch (error) {
    return handleError(error)
  }
}
