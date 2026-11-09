import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json, requiredPath } from '@cloud-learning/aws-clients'
import { readCourse } from '../../application/course-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try { return json(200, await readCourse(claimsFrom(event), requiredPath(event, 'courseId'))) }
  catch (error) { return handleError(error) }
}
