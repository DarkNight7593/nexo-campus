import { z } from 'zod'

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const isoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(isCalendarDate, 'Use a valid calendar date')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm')
const identifier = z.string().trim().min(1).max(128)
const scheduleDays = z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, 'Schedule days must be unique')

export const organizationSchema = z.object({
  organizationId: z.string().trim().min(3).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(120),
  domain: z.string().max(253).optional(),
  email: z.email().optional(),
  description: z.string().max(500).optional()
}).strict()

export const organizationUpdateSchema = organizationSchema.omit({ organizationId: true }).partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const profileSchema = z.object({
  email: z.email(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(['admin', 'instructor', 'student']),
  documentNumber: z.string().trim().min(4).max(30).optional()
}).strict()

export const profileUpdateSchema = profileSchema.pick({ fullName: true, documentNumber: true }).partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

const courseObjectSchema = z.object({
  instructorId: identifier,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  startDate: isoDate,
  endDate: isoDate,
  price: z.number().nonnegative()
}).strict()

export const courseSchema = courseObjectSchema.refine((value) => value.endDate >= value.startDate, {
  message: 'endDate must be greater than or equal to startDate',
  path: ['endDate']
})

export const courseUpdateSchema = courseObjectSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const scheduleSchema = z.object({
  courseId: identifier,
  days: scheduleDays,
  startTime: time,
  endTime: time,
  capacity: z.number().int().min(1).max(10_000),
  status: z.enum(['open', 'closed']).default('open')
}).strict().refine((value) => value.endTime > value.startTime, {
  message: 'endTime must be greater than startTime',
  path: ['endTime']
})

export const scheduleUpdateSchema = z.object({
  days: scheduleDays.optional(),
  startTime: time.optional(),
  endTime: time.optional(),
  capacity: z.number().int().min(1).max(10_000).optional(),
  status: z.enum(['open', 'closed']).optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required')

export const purchaseSchema = z.object({
  courseId: identifier,
  scheduleId: identifier
}).strict()

export const purchaseStatusSchema = z.object({
  status: z.enum(['enrolled', 'cancelled']),
  userId: identifier.optional()
}).strict()

export function parseBody<T>(schema: z.ZodType<T>, rawBody: string | null): T {
  if (!rawBody) return schema.parse(undefined)
  return schema.parse(JSON.parse(rawBody))
}
