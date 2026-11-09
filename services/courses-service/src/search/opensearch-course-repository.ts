import { createOpenSearchClient } from '@cloud-learning/aws-clients'
import { courseIndexDefinition, coursesIndex } from '@cloud-learning/contracts'
import type { Course, Schedule } from '@cloud-learning/contracts'

const client = createOpenSearchClient()

export async function ensureCourseIndex(): Promise<void> {
  const exists: any = await client.indices.exists({ index: coursesIndex })
  if (exists.body === true) return
  try {
    await client.indices.create({ index: coursesIndex, body: courseIndexDefinition as any })
  } catch (error: any) {
    if (error?.meta?.body?.error?.type !== 'resource_already_exists_exception') throw error
  }
}

export async function indexCourse(course: Course): Promise<void> {
  await ensureCourseIndex()
  const id = `${course.tenantId}#${course.courseId}`
  let schedules: Schedule[] = []
  try {
    const current: any = await client.get({ index: coursesIndex, id })
    schedules = current.body?._source?.schedules ?? []
  } catch (error: any) {
    if (error?.meta?.statusCode !== 404) throw error
  }
  await client.index({ index: coursesIndex, id, body: { ...course, schedules }, refresh: false })
}

export async function removeCourseFromIndex(tenantId: string, courseId: string): Promise<void> {
  try {
    await client.delete({ index: coursesIndex, id: `${tenantId}#${courseId}`, refresh: false })
  } catch (error: any) {
    if (error?.meta?.statusCode !== 404) throw error
  }
}

export interface CourseSearchInput {
  tenantId: string
  query?: string
  minPrice?: number
  maxPrice?: number
  startDate?: string
  endDate?: string
  pageSize: number
  from: number
}

export async function searchCourses(input: CourseSearchInput): Promise<{ items: Array<Course & { schedules: Schedule[] }>; total: number }> {
  const exists: any = await client.indices.exists({ index: coursesIndex })
  const indexExists = typeof exists === 'boolean' ? exists : exists.body === true
  if (!indexExists) return { items: [], total: 0 }
  const must: any[] = []
  const filter: any[] = [{ term: { tenantId: input.tenantId } }]
  if (input.query) {
    must.push({
      multi_match: {
        query: input.query,
        fields: ['name^3', 'name.prefix^2', 'description'],
        fuzziness: 'AUTO'
      }
    })
  }
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    filter.push({ range: { price: { gte: input.minPrice, lte: input.maxPrice } } })
  }
  if (input.startDate || input.endDate) {
    filter.push({ range: { startDate: { gte: input.startDate, lte: input.endDate } } })
  }
  const response: any = await client.search({
    index: coursesIndex,
    body: {
      from: input.from,
      size: input.pageSize,
      query: { bool: { must, filter } },
      // `name` is a full-text field and cannot be used for sorting unless a
      // keyword subfield/fielddata is added. `courseId` is already a keyword,
      // so it gives us a stable tie-breaker without loading text fielddata.
      sort: [{ _score: 'desc' }, { courseId: 'asc' }]
    }
  })
  const body = response.body ?? response
  return {
    items: (body.hits?.hits ?? []).map((hit: any) => hit._source),
    total: typeof body.hits?.total === 'number' ? body.hits.total : body.hits?.total?.value ?? 0
  }
}
