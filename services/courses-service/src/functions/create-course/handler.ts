import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { courseSchema, parseBody } from '@cloud-learning/validation'
import { createCourse } from '../../application/course-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try { return json(201, await createCourse(claimsFrom(event), parseBody(courseSchema, event.body))) }
  catch (error) { return handleError(error) }
}
