import type { AuthClaims, Purchase, PurchaseStatus } from '@cloud-learning/contracts'
import { HttpError, requireRole } from '@cloud-learning/aws-clients'
import { getCourseForPurchase, getScheduleForPurchase } from '../repositories/catalog-repository.js'
import { getPurchase, listPurchasesForTenant, listPurchasesForUser, reserveSeatAndCreatePurchase, transitionPurchase } from '../repositories/purchase-repository.js'

type PurchaseInput = Pick<Purchase, 'courseId' | 'scheduleId'>

export async function createPurchase(claims: AuthClaims, input: PurchaseInput, idempotencyKey: string): Promise<Purchase> {
  const existing = await getPurchase(claims.tenantId, claims.userId, idempotencyKey)
  if (existing) return existing
  const [course, schedule] = await Promise.all([
    getCourseForPurchase(claims.tenantId, input.courseId),
    getScheduleForPurchase(claims.tenantId, input.courseId, input.scheduleId)
  ])
  if (!course) throw new HttpError(404, 'Course not found')
  if (!schedule) throw new HttpError(404, 'Schedule not found for this course')
  if (course.endDate < new Date().toISOString().slice(0, 10)) throw new HttpError(409, 'Course has already ended')
  if (schedule.status !== 'open') throw new HttpError(409, 'Schedule is closed')
  if (schedule.occupiedCount >= schedule.capacity) throw new HttpError(409, 'Schedule has no available seats')
  const now = new Date().toISOString()
  const purchase: Purchase = {
    courseId: input.courseId,
    scheduleId: input.scheduleId,
    tenantId: claims.tenantId,
    userId: claims.userId,
    purchaseId: idempotencyKey,
    idempotencyKey,
    amount: course.price,
    status: 'reserved',
    createdAt: now,
    updatedAt: now
  }
  return reserveSeatAndCreatePurchase(purchase)
}

export async function readPurchases(claims: AuthClaims): Promise<Purchase[]> {
  return claims.role === 'admin'
    ? listPurchasesForTenant(claims.tenantId)
    : listPurchasesForUser(claims.tenantId, claims.userId)
}

export async function updatePurchaseStatus(claims: AuthClaims, purchaseId: string, status: PurchaseStatus, requestedUserId?: string): Promise<Purchase> {
  if (status === 'reserved') throw new HttpError(400, 'A purchase cannot transition back to reserved')
  if (status === 'enrolled') requireRole(claims, 'admin')
  if (requestedUserId && claims.role !== 'admin') throw new HttpError(403, 'Only admins can manage another user purchase')
  const userId = claims.role === 'admin' && requestedUserId ? requestedUserId : claims.userId
  const current = await getPurchase(claims.tenantId, userId, purchaseId)
  if (!current) throw new HttpError(404, 'Purchase not found')
  if (current.status === status) return current
  if (current.status === 'cancelled') throw new HttpError(409, 'Cancelled purchase cannot be changed')
  return transitionPurchase(current, status)
}

export async function cancelPurchase(claims: AuthClaims, purchaseId: string): Promise<Purchase> {
  return updatePurchaseStatus(claims, purchaseId, 'cancelled')
}
