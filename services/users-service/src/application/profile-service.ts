import type { AuthClaims, Profile } from '@cloud-learning/contracts'
import { HttpError, requireRole } from '@cloud-learning/aws-clients'
import { getProfile, listProfiles, saveProfile } from '../repositories/profile-repository.js'

export async function createMyProfile(claims: AuthClaims, input: Omit<Profile, 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Profile> {
  if (claims.role !== 'admin' && claims.role !== input.role) throw new HttpError(403, 'A user cannot assign a different role')
  if (!claims.email || claims.email.toLowerCase() !== input.email.toLowerCase()) {
    throw new HttpError(403, 'Profile email must match the authenticated identity')
  }
  const now = new Date().toISOString()
  const profile: Profile = { ...input, tenantId: claims.tenantId, userId: claims.userId, createdAt: now, updatedAt: now }
  await saveProfile(profile, true)
  return profile
}

export async function readMyProfile(claims: AuthClaims): Promise<Profile> {
  const profile = await getProfile(claims.tenantId, claims.userId)
  if (!profile) throw new HttpError(404, 'Profile not found')
  return profile
}

export async function readProfiles(claims: AuthClaims): Promise<Profile[]> {
  requireRole(claims, 'admin')
  return listProfiles(claims.tenantId)
}

export async function updateMyProfile(claims: AuthClaims, changes: Partial<Pick<Profile, 'fullName' | 'documentNumber'>>): Promise<Profile> {
  const current = await readMyProfile(claims)
  const updated: Profile = { ...current, ...changes, updatedAt: new Date().toISOString() }
  await saveProfile(updated)
  return updated
}
