import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, HttpError, json } from '@cloud-learning/aws-clients'
import { readCourses } from '../../application/course-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const rawLimit = event.queryStringParameters?.limit
    const limit = rawLimit === undefined ? 20 : Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, 'limit must be an integer between 1 and 100')
    return json(200, await readCourses(claimsFrom(event), limit, event.queryStringParameters?.nextToken))
  } catch (error) { return handleError(error) }
}
