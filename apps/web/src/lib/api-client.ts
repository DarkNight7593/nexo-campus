import type { RuntimeConfig } from '@cloud-learning/contracts'
import { idToken } from './auth-client.js'

export type ApiName = keyof RuntimeConfig['apiUrls']

export async function apiRequest<T>(config: RuntimeConfig, api: ApiName, path: string, init: RequestInit = {}): Promise<T> {
  const token = idToken()
  const response = await fetch(`${config.apiUrls[api].replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}), ...init.headers }
  })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((body as { message?: string }).message ?? `Error HTTP ${response.status}`)
  return body as T
}
