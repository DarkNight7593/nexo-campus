import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { readMyProfile } from '../../application/profile-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    return json(200, await readMyProfile(claimsFrom(event)))
  } catch (error) {
    return handleError(error)
  }
}
