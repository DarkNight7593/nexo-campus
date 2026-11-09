import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthClaims, Course, Purchase, Schedule } from '@cloud-learning/contracts'

const catalog = vi.hoisted(() => ({
  getCourseForPurchase: vi.fn(),
  getScheduleForPurchase: vi.fn()
}))
const purchases = vi.hoisted(() => ({
  getPurchase: vi.fn(),
  listPurchasesForTenant: vi.fn(),
  listPurchasesForUser: vi.fn(),
  reserveSeatAndCreatePurchase: vi.fn(),
  transitionPurchase: vi.fn()
}))

vi.mock('../repositories/catalog-repository.js', () => catalog)
vi.mock('../repositories/purchase-repository.js', () => purchases)

import { createPurchase, updatePurchaseStatus } from './purchase-service.js'

const student: AuthClaims = { userId: 'student-1', tenantId: 'tenant-a', role: 'student' }
const admin: AuthClaims = { userId: 'admin-1', tenantId: 'tenant-a', role: 'admin' }
const course: Course = {
  tenantId: 'tenant-a', courseId: 'course-1', instructorId: 'instructor-1', name: 'Course', description: 'Description',
  startDate: '2026-01-01', endDate: '2099-12-31', price: 249.9,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}
const schedule: Schedule = {
  tenantId: 'tenant-a', courseId: 'course-1', scheduleId: 'schedule-1', days: ['MON'], startTime: '18:00', endTime: '20:00',
  capacity: 30, occupiedCount: 4, status: 'open',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}
const purchase: Purchase = {
  tenantId: 'tenant-a', userId: 'student-1', purchaseId: '550e8400-e29b-41d4-a716-446655440000',
  idempotencyKey: '550e8400-e29b-41d4-a716-446655440000', courseId: 'course-1', scheduleId: 'schedule-1',
  status: 'reserved', amount: 249.9, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  catalog.getCourseForPurchase.mockResolvedValue(course)
  catalog.getScheduleForPurchase.mockResolvedValue(schedule)
  purchases.getPurchase.mockResolvedValue(undefined)
  purchases.reserveSeatAndCreatePurchase.mockImplementation(async (value: Purchase) => value)
  purchases.transitionPurchase.mockImplementation(async (value: Purchase, status: Purchase['status']) => ({ ...value, status }))
})

describe('purchase workflow', () => {
  it('uses the catalog price and creates a reserved, idempotent purchase', async () => {
    const result = await createPurchase(student, { courseId: 'course-1', scheduleId: 'schedule-1' }, purchase.idempotencyKey)
    expect(result).toMatchObject({
      userId: 'student-1', amount: 249.9, status: 'reserved', purchaseId: purchase.idempotencyKey,
      idempotencyKey: purchase.idempotencyKey
    })
    expect(purchases.reserveSeatAndCreatePurchase).toHaveBeenCalledOnce()
  })

  it('returns the original purchase when the idempotency key is retried', async () => {
    purchases.getPurchase.mockResolvedValue(purchase)
    await expect(createPurchase(student, { courseId: 'course-1', scheduleId: 'schedule-1' }, purchase.idempotencyKey))
      .resolves.toBe(purchase)
    expect(catalog.getCourseForPurchase).not.toHaveBeenCalled()
  })

  it('rejects a full schedule before attempting the transaction', async () => {
    catalog.getScheduleForPurchase.mockResolvedValue({ ...schedule, occupiedCount: 30 })
    await expect(createPurchase(student, { courseId: 'course-1', scheduleId: 'schedule-1' }, purchase.idempotencyKey))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(purchases.reserveSeatAndCreatePurchase).not.toHaveBeenCalled()
  })

  it('allows only an admin to confirm enrollment', async () => {
    purchases.getPurchase.mockResolvedValue(purchase)
    await expect(updatePurchaseStatus(student, purchase.purchaseId, 'enrolled')).rejects.toMatchObject({ statusCode: 403 })
    await expect(updatePurchaseStatus(admin, purchase.purchaseId, 'enrolled', 'student-1'))
      .resolves.toMatchObject({ status: 'enrolled' })
  })
})
