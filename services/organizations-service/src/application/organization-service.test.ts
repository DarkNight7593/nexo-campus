import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthClaims, Organization } from '@cloud-learning/contracts'

const repository = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  saveOrganization: vi.fn()
}))

vi.mock('../repositories/organization-repository.js', () => repository)

import { createOrganization, readOrganization, readOrganizations, updateOrganization } from './organization-service.js'

const claims: AuthClaims = { userId: 'admin-1', tenantId: 'tenant-a', role: 'admin', email: 'admin@tenant-a.demo' }
const organization: Organization = {
  organizationId: 'tenant-a',
  name: 'Tenant A',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  repository.getOrganization.mockResolvedValue(organization)
  repository.saveOrganization.mockResolvedValue(undefined)
})

describe('organization tenant isolation', () => {
  it('rejects creating another tenant', async () => {
    await expect(createOrganization(claims, { organizationId: 'tenant-b', name: 'Tenant B' }))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(repository.saveOrganization).not.toHaveBeenCalled()
  })

  it('rejects reading another tenant even for admin', async () => {
    await expect(readOrganization(claims, 'tenant-b')).rejects.toMatchObject({ statusCode: 403 })
    expect(repository.getOrganization).not.toHaveBeenCalled()
  })

  it('lists only the organization from the JWT tenant', async () => {
    await expect(readOrganizations(claims)).resolves.toEqual([organization])
    expect(repository.getOrganization).toHaveBeenCalledWith('tenant-a')
  })

  it('rejects updating another tenant', async () => {
    await expect(updateOrganization(claims, 'tenant-b', { name: 'Changed' })).rejects.toMatchObject({ statusCode: 403 })
    expect(repository.saveOrganization).not.toHaveBeenCalled()
  })
})
