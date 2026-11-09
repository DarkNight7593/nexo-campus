import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb } from '@cloud-learning/aws-clients'
import type { Course, Schedule } from '@cloud-learning/contracts'

const coursesTable = process.env.COURSES_TABLE
const schedulesTable = process.env.SCHEDULES_TABLE
if (!coursesTable) throw new Error('COURSES_TABLE is not configured')
if (!schedulesTable) throw new Error('SCHEDULES_TABLE is not configured')

export async function getCourseForPurchase(tenantId: string, courseId: string): Promise<Course | undefined> {
  const result = await dynamodb.send(new GetCommand({
    TableName: coursesTable,
    Key: { tenantId, courseId }
  }))
  return result.Item as Course | undefined
}

export async function getScheduleForPurchase(tenantId: string, courseId: string, scheduleId: string): Promise<Schedule | undefined> {
  const result = await dynamodb.send(new GetCommand({
    TableName: schedulesTable,
    Key: { tenantCourseId: `${tenantId}#${courseId}`, scheduleId }
  }))
  return result.Item as Schedule | undefined
}
