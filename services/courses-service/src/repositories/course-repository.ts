import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { decodeNextToken, dynamodb, encodeNextToken, HttpError } from '@cloud-learning/aws-clients'
import type { Course, ListResponse } from '@cloud-learning/contracts'

const tableName = process.env.COURSES_TABLE
if (!tableName) throw new Error('COURSES_TABLE is not configured')

export async function saveCourse(course: Course, onlyIfNew = false): Promise<void> {
  try {
    await dynamodb.send(new PutCommand({
      TableName: tableName,
      Item: course,
      ConditionExpression: onlyIfNew ? 'attribute_not_exists(tenantId) AND attribute_not_exists(courseId)' : undefined
    }))
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'Course already exists')
    throw error
  }
}

export async function getCourse(tenantId: string, courseId: string): Promise<Course | undefined> {
  const result = await dynamodb.send(new GetCommand({ TableName: tableName, Key: { tenantId, courseId } }))
  return result.Item as Course | undefined
}

export async function listCourses(tenantId: string, limit: number, nextToken?: string): Promise<ListResponse<Course>> {
  const result = await dynamodb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'tenantId = :tenantId',
    ExpressionAttributeValues: { ':tenantId': tenantId },
    Limit: limit,
    ExclusiveStartKey: decodeNextToken(nextToken, { tenantId })
  }))
  return {
    items: (result.Items ?? []) as Course[],
    nextToken: encodeNextToken(result.LastEvaluatedKey)
  }
}

export async function deleteCourse(tenantId: string, courseId: string): Promise<void> {
  await dynamodb.send(new DeleteCommand({ TableName: tableName, Key: { tenantId, courseId } }))
}
