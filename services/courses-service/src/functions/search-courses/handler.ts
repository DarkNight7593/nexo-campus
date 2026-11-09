import type { APIGatewayProxyHandler } from 'aws-lambda'
import { claimsFrom, handleError, HttpError, json } from '@cloud-learning/aws-clients'
import { searchCourses } from '../../search/opensearch-course-repository.js'

function optionalNumber(name: string, value: string | undefined, options: { integer?: boolean; min?: number; max?: number } = {}): number | undefined {
  if (value === undefined || value === '') return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || (options.integer && !Number.isInteger(number)) ||
    (options.min !== undefined && number < options.min) || (options.max !== undefined && number > options.max)) {
    throw new HttpError(400, `Invalid ${name}`)
  }
  return number
}

function optionalDate(name: string, value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `Invalid ${name}`)
  }
  return value
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const claims = claimsFrom(event)
    const query = event.queryStringParameters ?? {}
    const pageSize = optionalNumber('pageSize', query.pageSize, { integer: true, min: 1, max: 100 }) ?? 20
    const from = optionalNumber('from', query.from, { integer: true, min: 0, max: 9_999 }) ?? 0
    const searchQuery = query.q?.trim()
    if (searchQuery && searchQuery.length > 200) throw new HttpError(400, 'q must contain at most 200 characters')
    if (from + pageSize > 10_000) throw new HttpError(400, 'from plus pageSize cannot exceed 10000')
    const minPrice = optionalNumber('minPrice', query.minPrice, { min: 0 })
    const maxPrice = optionalNumber('maxPrice', query.maxPrice, { min: 0 })
    const startDate = optionalDate('startDate', query.startDate)
    const endDate = optionalDate('endDate', query.endDate)
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw new HttpError(400, 'minPrice must be less than or equal to maxPrice')
    if (startDate && endDate && startDate > endDate) throw new HttpError(400, 'startDate must be less than or equal to endDate')
    return json(200, await searchCourses({
      tenantId: claims.tenantId,
      query: searchQuery || undefined,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      pageSize,
      from
    }))
  } catch (error) { return handleError(error) }
}
