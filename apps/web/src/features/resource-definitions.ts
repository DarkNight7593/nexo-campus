import type { ApiName } from '../lib/api-client.js'
import type { UserRole } from '@cloud-learning/contracts'
import type { IconName } from '../components/Icon.js'
import { organizationsResource } from './organizations/resource.js'
import { usersResource } from './users/resource.js'
import { coursesResource } from './courses/resource.js'
import { schedulesResource } from './schedules/resource.js'
import { purchasesResource } from './purchases/resource.js'

export interface ResourceColumn { key: string; label: string }
export interface ResourceFormField {
  key: string
  label: string
  type?: 'text' | 'email' | 'number' | 'date' | 'time' | 'array' | 'select'
  options?: string[]
  placeholder?: string
}
export interface ResourceDefinition {
  key: string
  label: string
  singular: string
  description: string
  icon: IconName
  api: ApiName
  path: string
  columns: ResourceColumn[]
  form: ResourceFormField[]
  sample: Record<string, unknown>
  createRoles: UserRole[]
  query?: { key: string; label: string; placeholder: string }
}

export const resources: ResourceDefinition[] = [organizationsResource, usersResource, coursesResource, schedulesResource, purchasesResource]
