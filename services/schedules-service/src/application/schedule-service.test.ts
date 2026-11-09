import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthClaims, Course, Schedule } from '@cloud-learning/contracts'

const schedules = vi.hoisted(() => ({
  deleteSchedule: vi.fn(),
  getSchedule: vi.fn(),
  listSchedules: vi.fn(),
  saveSchedule: vi.fn()
}))
const courses = vi.hoisted(() => ({ getCourseForSchedule: vi.fn() }))

vi.mock('../repositories/schedule-repository.js', () => schedules)
vi.mock('../repositories/course-access-repository.js', () => courses)

import { createSchedule, deleteSchedule, updateSchedule } from './schedule-service.js'

const instructor: AuthClaims = { userId: 'instructor-1', tenantId: 'tenant-a', role: 'instructor' }
const admin: AuthClaims = { userId: 'admin-1', tenantId: 'tenant-a', role: 'admin' }
const course: Course = {
  tenantId: 'tenant-a', courseId: 'course-1', instructorId: 'instructor-1', name: 'Course', description: 'Description',
  startDate: '2026-01-01', endDate: '2026-02-01', price: 10,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}
const schedule: Schedule = {
  tenantId: 'tenant-a', courseId: 'course-1', scheduleId: 'schedule-1', days: ['MON'], startTime: '18:00', endTime: '20:00',
  capacity: 30, occupiedCount: 0, status: 'open',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  courses.getCourseForSchedule.mockResolvedValue(course)
  schedules.getSchedule.mockResolvedValue(schedule)
  schedules.saveSchedule.mockResolvedValue(undefined)
  schedules.deleteSchedule.mockResolvedValue(undefined)
})

describe('schedule course ownership', () => {
  it('allows the course instructor to manage schedules', async () => {
    await expect(createSchedule(instructor, { courseId: 'course-1', days: ['MON'], startTime: '18:00', endTime: '20:00', capacity: 30 }))
      .resolves.toMatchObject({ tenantId: 'tenant-a', courseId: 'course-1' })
    await expect(updateSchedule(instructor, 'course-1', 'schedule-1', { endTime: '21:00' }))
      .resolves.toMatchObject({ endTime: '21:00' })
  })

  it('rejects an instructor managing another instructor course', async () => {
    courses.getCourseForSchedule.mockResolvedValue({ ...course, instructorId: 'instructor-2' })
    await expect(createSchedule(instructor, { courseId: 'course-1', days: ['MON'], startTime: '18:00', endTime: '20:00', capacity: 30 }))
      .rejects.toMatchObject({ statusCode: 403 })
    await expect(deleteSchedule(instructor, 'course-1', 'schedule-1')).rejects.toMatchObject({ statusCode: 403 })
    expect(schedules.deleteSchedule).not.toHaveBeenCalled()
  })

  it('rejects schedules for a missing course and lets admins manage an existing one', async () => {
    courses.getCourseForSchedule.mockResolvedValue(undefined)
    await expect(createSchedule(admin, { courseId: 'missing', days: ['MON'], startTime: '18:00', endTime: '20:00', capacity: 30 }))
      .rejects.toMatchObject({ statusCode: 404 })
    courses.getCourseForSchedule.mockResolvedValue(course)
    await expect(deleteSchedule(admin, 'course-1', 'schedule-1')).resolves.toBeUndefined()
  })
})
