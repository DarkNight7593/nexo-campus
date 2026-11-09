import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { parseBody, profileSchema } from '@cloud-learning/validation'
import { createMyProfile } from '../../application/profile-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const claims = claimsFrom(event)
    const input = parseBody(profileSchema, event.body)
    return json(201, await createMyProfile(claims, input))
  } catch (error) {
    return handleError(error)
  }
}
