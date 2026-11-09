export type UserRole = 'admin' | 'instructor' | 'student'

export interface Organization {
  organizationId: string
  name: string
  domain?: string
  email?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Profile {
  tenantId: string
  userId: string
  email: string
  fullName: string
  role: UserRole
  documentNumber?: string
  createdAt: string
  updatedAt: string
}

export interface Course {
  tenantId: string
  courseId: string
  instructorId: string
  name: string
  description: string
  startDate: string
  endDate: string
  price: number
  createdAt: string
  updatedAt: string
}

export interface Schedule {
  tenantId: string
  courseId: string
  scheduleId: string
  days: string[]
  startTime: string
  endTime: string
  capacity: number
  occupiedCount: number
  status: 'open' | 'closed'
  createdAt: string
  updatedAt: string
}

export type PurchaseStatus = 'reserved' | 'enrolled' | 'cancelled'

export interface Purchase {
  tenantId: string
  userId: string
  purchaseId: string
  courseId: string
  scheduleId: string
  status: PurchaseStatus
  amount: number
  idempotencyKey: string
  createdAt: string
  updatedAt: string
}

export interface AuthClaims {
  userId: string
  tenantId: string
  role: UserRole
  email?: string
}

export interface AuthRuntimeConfig {
  mode: 'cognito'
  domain: string
  clientId: string
  redirectUri: string
  logoutUri: string
}

export interface RuntimeConfig {
  region: string
  stage: string
  apiUrls: {
    users: string
    organizations: string
    courses: string
    schedules: string
    purchases: string
  }
  auth: AuthRuntimeConfig
}

export interface ListResponse<T> {
  items: T[]
  nextToken?: string
}

export { courseIndexDefinition, coursesIndex } from './course-search.js'
