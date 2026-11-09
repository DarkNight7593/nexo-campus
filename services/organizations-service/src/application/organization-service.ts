import type { AuthClaims, Organization } from '@cloud-learning/contracts'
import { HttpError, requireRole } from '@cloud-learning/aws-clients'
import { getOrganization, saveOrganization } from '../repositories/organization-repository.js'

type OrganizationInput = Omit<Organization, 'createdAt' | 'updatedAt'>

export async function createOrganization(claims: AuthClaims, input: OrganizationInput): Promise<Organization> {
  requireRole(claims, 'admin')
  if (input.organizationId !== claims.tenantId) throw new HttpError(403, 'Cannot create another tenant organization')
  const now = new Date().toISOString()
  const organization: Organization = { ...input, createdAt: now, updatedAt: now }
  await saveOrganization(organization, true)
  return organization
}

export async function readOrganization(claims: AuthClaims, organizationId: string): Promise<Organization> {
  if (claims.tenantId !== organizationId) throw new HttpError(403, 'Cannot access another organization')
  const organization = await getOrganization(organizationId)
  if (!organization) throw new HttpError(404, 'Organization not found')
  return organization
}

export async function readOrganizations(claims: AuthClaims): Promise<Organization[]> {
  requireRole(claims, 'admin')
  const organization = await getOrganization(claims.tenantId)
  return organization ? [organization] : []
}

export async function updateOrganization(claims: AuthClaims, organizationId: string, changes: Partial<Pick<Organization, 'name' | 'domain' | 'email' | 'description'>>): Promise<Organization> {
  requireRole(claims, 'admin')
  if (claims.tenantId !== organizationId) throw new HttpError(403, 'Cannot update another organization')
  const current = await readOrganization(claims, organizationId)
  const updated: Organization = { ...current, ...changes, updatedAt: new Date().toISOString() }
  await saveOrganization(updated)
  return updated
}
