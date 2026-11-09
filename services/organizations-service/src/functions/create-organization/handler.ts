import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { organizationSchema, parseBody } from '@cloud-learning/validation'
import { createOrganization } from '../../application/organization-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    return json(201, await createOrganization(claimsFrom(event), parseBody(organizationSchema, event.body)))
  } catch (error) {
    return handleError(error)
  }
}
