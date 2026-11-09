import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, HttpError, json, requiredPath } from '@cloud-learning/aws-clients'
import { deleteSchedule } from '../../application/schedule-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const courseId = event.queryStringParameters?.courseId
    if (!courseId || courseId.length > 128) throw new HttpError(400, 'courseId is required and must contain at most 128 characters')
    await deleteSchedule(claimsFrom(event), courseId, requiredPath(event, 'scheduleId'))
    return json(204, null)
  } catch (error) { return handleError(error) }
}
