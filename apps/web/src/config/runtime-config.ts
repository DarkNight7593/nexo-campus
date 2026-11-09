import type { RuntimeConfig } from '@cloud-learning/contracts'

let cached: RuntimeConfig | undefined

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached
  const response = await fetch('/runtime-config.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo cargar runtime-config.json')
  cached = await response.json() as RuntimeConfig
  return cached
}
