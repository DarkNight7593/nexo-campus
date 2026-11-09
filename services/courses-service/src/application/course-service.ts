import type { AuthClaims, Course, ListResponse } from '@cloud-learning/contracts'
import { HttpError, requireRole } from '@cloud-learning/aws-clients'
import { deleteCourse as remove, getCourse, listCourses, saveCourse } from '../repositories/course-repository.js'

type CourseInput = Omit<Course, 'tenantId' | 'courseId' | 'createdAt' | 'updatedAt'>

export async function createCourse(claims: AuthClaims, input: CourseInput): Promise<Course> {
  requireRole(claims, 'admin', 'instructor')
  if (claims.role === 'instructor' && input.instructorId !== claims.userId) throw new HttpError(403, 'Instructor can only create their own courses')
  const now = new Date().toISOString()
  const course: Course = { ...input, tenantId: claims.tenantId, courseId: crypto.randomUUID(), createdAt: now, updatedAt: now }
  await saveCourse(course, true)
  return course
}

export async function readCourse(claims: AuthClaims, courseId: string): Promise<Course> {
  const course = await getCourse(claims.tenantId, courseId)
  if (!course) throw new HttpError(404, 'Course not found')
  return course
}

export async function readCourses(claims: AuthClaims, limit: number, nextToken?: string): Promise<ListResponse<Course>> {
  return listCourses(claims.tenantId, limit, nextToken)
}

export async function updateCourse(claims: AuthClaims, courseId: string, changes: Partial<CourseInput>): Promise<Course> {
  requireRole(claims, 'admin', 'instructor')
  const current = await readCourse(claims, courseId)
  if (claims.role === 'instructor' && current.instructorId !== claims.userId) throw new HttpError(403, 'Instructor does not own this course')
  if (claims.role === 'instructor' && changes.instructorId && changes.instructorId !== claims.userId) {
    throw new HttpError(403, 'Instructor cannot reassign a course')
  }
  const updated: Course = { ...current, ...changes, tenantId: current.tenantId, courseId: current.courseId, updatedAt: new Date().toISOString() }
  if (updated.endDate < updated.startDate) throw new HttpError(400, 'endDate must be greater than or equal to startDate')
  await saveCourse(updated)
  return updated
}

export async function deleteCourse(claims: AuthClaims, courseId: string): Promise<void> {
  requireRole(claims, 'admin', 'instructor')
  const current = await readCourse(claims, courseId)
  if (claims.role === 'instructor' && current.instructorId !== claims.userId) throw new HttpError(403, 'Instructor does not own this course')
  await remove(claims.tenantId, courseId)
}
