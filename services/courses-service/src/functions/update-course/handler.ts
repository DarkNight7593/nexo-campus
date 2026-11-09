import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json, requiredPath } from '@cloud-learning/aws-clients'
import { courseUpdateSchema, parseBody } from '@cloud-learning/validation'
import { updateCourse } from '../../application/course-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    return json(200, await updateCourse(claimsFrom(event), requiredPath(event, 'courseId'), parseBody(courseUpdateSchema, event.body)))
  } catch (error) { return handleError(error) }
}
