import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthClaims, Profile } from '@cloud-learning/contracts'

const repository = vi.hoisted(() => ({
  getProfile: vi.fn(),
  listProfiles: vi.fn(),
  saveProfile: vi.fn()
}))

vi.mock('../repositories/profile-repository.js', () => repository)

import { createMyProfile, readProfiles, updateMyProfile } from './profile-service.js'

const claims: AuthClaims = {
  userId: 'student-1', tenantId: 'tenant-a', role: 'student', email: 'student@example.test'
}
const profile: Profile = {
  tenantId: 'tenant-a', userId: 'student-1', email: 'student@example.test', fullName: 'Student One', role: 'student',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  repository.getProfile.mockResolvedValue(profile)
  repository.listProfiles.mockResolvedValue([profile])
  repository.saveProfile.mockResolvedValue(undefined)
})

describe('profile authorization', () => {
  it('binds a profile to the authenticated identity', async () => {
    const created = await createMyProfile(claims, { email: 'STUDENT@example.test', fullName: 'Student One', role: 'student' })
    expect(created).toMatchObject({ tenantId: 'tenant-a', userId: 'student-1', role: 'student' })
    expect(repository.saveProfile).toHaveBeenCalledWith(created, true)
  })

  it('rejects a different email or role', async () => {
    await expect(createMyProfile(claims, { email: 'other@example.test', fullName: 'Other', role: 'student' }))
      .rejects.toMatchObject({ statusCode: 403 })
    await expect(createMyProfile({ ...claims, email: undefined }, { email: 'student@example.test', fullName: 'Student One', role: 'student' }))
      .rejects.toMatchObject({ statusCode: 403 })
    await expect(createMyProfile(claims, { email: 'student@example.test', fullName: 'Student One', role: 'admin' }))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(repository.saveProfile).not.toHaveBeenCalled()
  })

  it('allows only admins to list a tenant', async () => {
    await expect(readProfiles(claims)).rejects.toMatchObject({ statusCode: 403 })
    expect(repository.listProfiles).not.toHaveBeenCalled()
  })

  it('preserves immutable identity fields during update', async () => {
    const updated = await updateMyProfile(claims, { fullName: 'Updated Student' })
    expect(updated).toMatchObject({ tenantId: 'tenant-a', userId: 'student-1', email: 'student@example.test', fullName: 'Updated Student' })
  })
})
