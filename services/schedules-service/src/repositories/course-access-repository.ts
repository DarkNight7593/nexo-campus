import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb } from '@cloud-learning/aws-clients'
import type { Course } from '@cloud-learning/contracts'

export async function getCourseForSchedule(tenantId: string, courseId: string): Promise<Course | undefined> {
  const coursesTable = process.env.COURSES_TABLE
  if (!coursesTable) throw new Error('COURSES_TABLE is not configured')

  const result = await dynamodb.send(new GetCommand({
    TableName: coursesTable,
    Key: { tenantId, courseId }
  }))
  return result.Item as Course | undefined
}
