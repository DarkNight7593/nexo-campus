import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { parseBody, profileUpdateSchema } from '@cloud-learning/validation'
import { updateMyProfile } from '../../application/profile-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const input = parseBody(profileUpdateSchema, event.body)
    return json(200, await updateMyProfile(claimsFrom(event), input))
  } catch (error) {
    return handleError(error)
  }
}
