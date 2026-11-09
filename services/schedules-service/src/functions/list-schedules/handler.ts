import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, HttpError, json } from '@cloud-learning/aws-clients'
import { readSchedules } from '../../application/schedule-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const courseId = event.queryStringParameters?.courseId
    if (!courseId || courseId.length > 128) throw new HttpError(400, 'courseId is required and must contain at most 128 characters')
    return json(200, { items: await readSchedules(claimsFrom(event), courseId) })
  } catch (error) { return handleError(error) }
}
