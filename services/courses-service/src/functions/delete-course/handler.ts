import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json, requiredPath } from '@cloud-learning/aws-clients'
import { deleteCourse } from '../../application/course-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    await deleteCourse(claimsFrom(event), requiredPath(event, 'courseId'))
    return json(204, null)
  } catch (error) { return handleError(error) }
}
