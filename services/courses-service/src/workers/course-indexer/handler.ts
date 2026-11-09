import type { DynamoDBStreamHandler } from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { Course } from '@cloud-learning/contracts'
import { indexCourse, removeCourseFromIndex } from '../../search/opensearch-course-repository.js'

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    const image = record.eventName === 'REMOVE' ? record.dynamodb?.OldImage : record.dynamodb?.NewImage
    if (!image) continue
    const course = unmarshall(image as any) as Course
    if (record.eventName === 'REMOVE') await removeCourseFromIndex(course.tenantId, course.courseId)
    else await indexCourse(course)
  }
}
