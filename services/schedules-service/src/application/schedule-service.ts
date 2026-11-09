import type { AuthClaims, Schedule } from '@cloud-learning/contracts'
import { HttpError, requireRole } from '@cloud-learning/aws-clients'
import { deleteSchedule as remove, getSchedule, listSchedules, saveSchedule } from '../repositories/schedule-repository.js'
import { getCourseForSchedule } from '../repositories/course-access-repository.js'

type ScheduleInput = Omit<Schedule, 'tenantId' | 'scheduleId' | 'occupiedCount' | 'status' | 'createdAt' | 'updatedAt'> & {
  status?: Schedule['status']
}

async function assertCanManageCourse(claims: AuthClaims, courseId: string): Promise<void> {
  requireRole(claims, 'admin', 'instructor')
  const course = await getCourseForSchedule(claims.tenantId, courseId)
  if (!course) throw new HttpError(404, 'Course not found')
  if (claims.role === 'instructor' && course.instructorId !== claims.userId) {
    throw new HttpError(403, 'Instructor does not own this course')
  }
}

export async function createSchedule(claims: AuthClaims, input: ScheduleInput): Promise<Schedule> {
  await assertCanManageCourse(claims, input.courseId)
  const now = new Date().toISOString()
  const schedule: Schedule = { ...input, status: input.status ?? 'open', tenantId: claims.tenantId, scheduleId: crypto.randomUUID(), occupiedCount: 0, createdAt: now, updatedAt: now }
  await saveSchedule(schedule, true)
  return schedule
}

export async function readSchedules(claims: AuthClaims, courseId: string): Promise<Schedule[]> {
  return listSchedules(claims.tenantId, courseId)
}

export async function updateSchedule(claims: AuthClaims, courseId: string, scheduleId: string, changes: Partial<Omit<ScheduleInput, 'courseId'>>): Promise<Schedule> {
  await assertCanManageCourse(claims, courseId)
  const current = await getSchedule(claims.tenantId, courseId, scheduleId)
  if (!current) throw new HttpError(404, 'Schedule not found')
  const updated: Schedule = { ...current, ...changes, updatedAt: new Date().toISOString() }
  if (updated.endTime <= updated.startTime) throw new HttpError(400, 'endTime must be greater than startTime')
  if (updated.capacity < updated.occupiedCount) throw new HttpError(409, 'Capacity cannot be lower than occupied seats')
  await saveSchedule(updated, false, current.occupiedCount)
  return updated
}

export async function deleteSchedule(claims: AuthClaims, courseId: string, scheduleId: string): Promise<void> {
  await assertCanManageCourse(claims, courseId)
  await remove(claims.tenantId, courseId, scheduleId)
}
