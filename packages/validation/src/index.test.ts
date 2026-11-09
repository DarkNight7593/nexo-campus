import { describe, expect, it } from 'vitest'
import { courseSchema, courseUpdateSchema, organizationUpdateSchema, parseBody, profileUpdateSchema, scheduleSchema, scheduleUpdateSchema } from './index.js'

describe('domain validation', () => {
  it('accepts a valid course', () => {
    expect(courseSchema.parse({ instructorId: 'u-1', name: 'AWS', description: 'Curso', startDate: '2026-01-01', endDate: '2026-02-01', price: 10 }).price).toBe(10)
  })

  it('rejects a course whose end date precedes its start date', () => {
    expect(() => courseSchema.parse({ instructorId: 'u-1', name: 'AWS', description: 'Curso', startDate: '2026-02-01', endDate: '2026-01-01', price: 10 })).toThrow()
  })

  it('accepts a partial course update without evaluating missing dates', () => {
    expect(courseUpdateSchema.parse({ description: 'Actualizado' })).toEqual({ description: 'Actualizado' })
  })

  it('rejects empty updates', () => {
    expect(() => courseUpdateSchema.parse({})).toThrow()
    expect(() => organizationUpdateSchema.parse({})).toThrow()
    expect(() => profileUpdateSchema.parse({})).toThrow()
    expect(() => scheduleUpdateSchema.parse({})).toThrow()
  })

  it('normalizes user-facing names in updates', () => {
    expect(organizationUpdateSchema.parse({ name: '  Example Academy  ' }).name).toBe('Example Academy')
    expect(profileUpdateSchema.parse({ fullName: '  Example User  ' }).fullName).toBe('Example User')
  })

  it('rejects dates that match the format but do not exist', () => {
    expect(() => courseSchema.parse({ instructorId: 'u-1', name: 'AWS', description: 'Curso', startDate: '2026-02-30', endDate: '2026-03-01', price: 10 })).toThrow()
  })

  it('rejects properties not declared by the OpenAPI contract', () => {
    expect(() => courseUpdateSchema.parse({ description: 'Actualizado', tenantId: 'otro-tenant' })).toThrow()
  })

  it('rejects an invalid schedule range', () => {
    expect(() => scheduleSchema.parse({ courseId: 'c-1', days: ['MON'], startTime: '20:00', endTime: '18:00', capacity: 30 })).toThrow()
  })

  it('rejects duplicated or unknown schedule days', () => {
    expect(() => scheduleSchema.parse({ courseId: 'c-1', days: ['MON', 'MON'], startTime: '18:00', endTime: '20:00', capacity: 30 })).toThrow()
    expect(() => scheduleSchema.parse({ courseId: 'c-1', days: ['LUN'], startTime: '18:00', endTime: '20:00', capacity: 30 })).toThrow()
  })

  it('parses API Gateway JSON bodies', () => {
    const value = parseBody(scheduleSchema, JSON.stringify({ courseId: 'c-1', days: ['MON'], startTime: '18:00', endTime: '20:00', capacity: 30 }))
    expect(value.courseId).toBe('c-1')
  })
})
