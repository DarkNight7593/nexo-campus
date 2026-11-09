import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthClaims, Course } from '@cloud-learning/contracts'

const repository = vi.hoisted(() => ({
  deleteCourse: vi.fn(),
  getCourse: vi.fn(),
  listCourses: vi.fn(),
  saveCourse: vi.fn()
}))

vi.mock('../repositories/course-repository.js', () => repository)

import { createCourse, deleteCourse, updateCourse } from './course-service.js'

const instructor: AuthClaims = { userId: 'instructor-1', tenantId: 'tenant-a', role: 'instructor' }
const admin: AuthClaims = { userId: 'admin-1', tenantId: 'tenant-a', role: 'admin' }
const course: Course = {
  tenantId: 'tenant-a', courseId: 'course-1', instructorId: 'instructor-1', name: 'Course', description: 'Description',
  startDate: '2026-01-01', endDate: '2026-02-01', price: 10,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  repository.getCourse.mockResolvedValue(course)
  repository.saveCourse.mockResolvedValue(undefined)
  repository.deleteCourse.mockResolvedValue(undefined)
})

describe('course ownership', () => {
  it('allows an instructor to create and update their own course', async () => {
    await expect(createCourse(instructor, {
      instructorId: 'instructor-1', name: 'Course', description: 'Description', startDate: '2026-01-01', endDate: '2026-02-01', price: 10
    })).resolves.toMatchObject({ tenantId: 'tenant-a', instructorId: 'instructor-1' })
    await expect(updateCourse(instructor, 'course-1', { name: 'Updated' })).resolves.toMatchObject({ name: 'Updated' })
  })

  it('rejects creating or reassigning a course for another instructor', async () => {
    await expect(createCourse(instructor, {
      instructorId: 'instructor-2', name: 'Course', description: 'Description', startDate: '2026-01-01', endDate: '2026-02-01', price: 10
    })).rejects.toMatchObject({ statusCode: 403 })
    await expect(updateCourse(instructor, 'course-1', { instructorId: 'instructor-2' }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('allows an admin to reassign a course', async () => {
    await expect(updateCourse(admin, 'course-1', { instructorId: 'instructor-2' }))
      .resolves.toMatchObject({ instructorId: 'instructor-2' })
  })

  it('rejects mutation of a course owned by another instructor', async () => {
    repository.getCourse.mockResolvedValue({ ...course, instructorId: 'instructor-2' })
    await expect(updateCourse(instructor, 'course-1', { name: 'Changed' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(deleteCourse(instructor, 'course-1')).rejects.toMatchObject({ statusCode: 403 })
  })
})
