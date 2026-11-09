import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { readProfiles } from '../../application/profile-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    return json(200, { items: await readProfiles(claimsFrom(event)) })
  } catch (error) {
    return handleError(error)
  }
}
