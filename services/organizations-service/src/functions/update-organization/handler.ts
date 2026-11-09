import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json, requiredPath } from '@cloud-learning/aws-clients'
import { organizationUpdateSchema, parseBody } from '@cloud-learning/validation'
import { updateOrganization } from '../../application/organization-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const organizationId = requiredPath(event, 'organizationId')
    return json(200, await updateOrganization(claimsFrom(event), organizationId, parseBody(organizationUpdateSchema, event.body)))
  } catch (error) {
    return handleError(error)
  }
}
