import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, json } from '@cloud-learning/aws-clients'
import { parseBody, scheduleSchema } from '@cloud-learning/validation'
import { createSchedule } from '../../application/schedule-service.js'

export const handler: APIGatewayProxyHandler = async (event) => {
  try { return json(201, await createSchedule(claimsFrom(event), parseBody(scheduleSchema, event.body))) }
  catch (error) { return handleError(error) }
}
