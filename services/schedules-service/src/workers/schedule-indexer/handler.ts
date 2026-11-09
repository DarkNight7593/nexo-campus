import type { DynamoDBStreamHandler } from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { createOpenSearchClient } from '@cloud-learning/aws-clients'
import { courseIndexDefinition, coursesIndex } from '@cloud-learning/contracts'
import type { Schedule } from '@cloud-learning/contracts'
import { listSchedules } from '../../repositories/schedule-repository.js'

const client = createOpenSearchClient()

async function ensureCourseIndex(): Promise<void> {
  const exists: any = await client.indices.exists({ index: coursesIndex })
  if (exists.body === true) return
  try {
    await client.indices.create({ index: coursesIndex, body: courseIndexDefinition as any })
  } catch (error: any) {
    if (error?.meta?.body?.error?.type !== 'resource_already_exists_exception') throw error
  }
}

export const handler: DynamoDBStreamHandler = async (event) => {
  await ensureCourseIndex()
  const affectedCourses = new Map<string, { schedule: Schedule; requiresCourseDocument: boolean }>()
  for (const record of event.Records) {
    const image = record.eventName === 'REMOVE' ? record.dynamodb?.OldImage : record.dynamodb?.NewImage
    if (!image) continue
    const changed = unmarshall(image as any) as Schedule
    const key = `${changed.tenantId}#${changed.courseId}`
    const current = affectedCourses.get(key)
    affectedCourses.set(key, {
      schedule: changed,
      requiresCourseDocument: Boolean(current?.requiresCourseDocument || record.eventName !== 'REMOVE')
    })
  }

  for (const [courseDocumentId, affected] of affectedCourses) {
    const changed = affected.schedule
    const schedules = await listSchedules(changed.tenantId, changed.courseId)
    try {
      await client.update({
        index: coursesIndex,
        id: courseDocumentId,
        body: { doc: { schedules }, doc_as_upsert: false },
        refresh: false
      })
    } catch (error: any) {
      // Inserts/updates are retried until the corresponding course document is
      // indexed. A removal may legitimately arrive after the course vanished.
      if (error?.meta?.statusCode !== 404 || affected.requiresCourseDocument) throw error
    }
  }
}
