import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, HttpError } from '@cloud-learning/aws-clients'
import type { Schedule } from '@cloud-learning/contracts'

const tableName = process.env.SCHEDULES_TABLE
if (!tableName) throw new Error('SCHEDULES_TABLE is not configured')

const tenantCourseId = (tenantId: string, courseId: string) => `${tenantId}#${courseId}`

export async function saveSchedule(schedule: Schedule, onlyIfNew = false, expectedOccupiedCount?: number): Promise<void> {
  const conditionExpression = onlyIfNew
    ? 'attribute_not_exists(tenantCourseId) AND attribute_not_exists(scheduleId)'
    : expectedOccupiedCount === undefined ? undefined : 'occupiedCount = :expectedOccupiedCount'
  try {
    await dynamodb.send(new PutCommand({
      TableName: tableName,
      Item: { ...schedule, tenantCourseId: tenantCourseId(schedule.tenantId, schedule.courseId) },
      ConditionExpression: conditionExpression,
      ExpressionAttributeValues: expectedOccupiedCount === undefined ? undefined : { ':expectedOccupiedCount': expectedOccupiedCount }
    }))
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') {
      throw new HttpError(409, onlyIfNew ? 'Schedule already exists' : 'Schedule changed concurrently; reload and try again')
    }
    throw error
  }
}

export async function getSchedule(tenantId: string, courseId: string, scheduleId: string): Promise<Schedule | undefined> {
  const result = await dynamodb.send(new GetCommand({
    TableName: tableName,
    Key: { tenantCourseId: tenantCourseId(tenantId, courseId), scheduleId },
    ConsistentRead: true
  }))
  return result.Item as Schedule | undefined
}

export async function listSchedules(tenantId: string, courseId: string): Promise<Schedule[]> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'tenantCourseId = :key',
    ExpressionAttributeValues: { ':key': tenantCourseId(tenantId, courseId) }
  }))
  return (result.Items ?? []) as Schedule[]
}

export async function deleteSchedule(tenantId: string, courseId: string, scheduleId: string): Promise<void> {
  await dynamodb.send(new DeleteCommand({
    TableName: tableName,
    Key: { tenantCourseId: tenantCourseId(tenantId, courseId), scheduleId }
  }))
}
