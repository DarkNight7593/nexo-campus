import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function loadLocalEnvironment(): void {
  loadEnv({ path: path.join(root, '.env.local'), override: false, quiet: true })
}

export function npmExecutable(): string { return process.platform === 'win32' ? 'npm.cmd' : 'npm' }

export function assertAwsTarget(stage: string, actualAccount: string | undefined): void {
  if (!['dev', 'staging', 'production'].includes(stage)) throw new Error(`Stage AWS no permitido: ${stage}`)
  if (!actualAccount) throw new Error('AWS no devolvió un Account ID')
  const expected = process.env.EXPECTED_AWS_ACCOUNT_ID?.trim()
  if ((stage === 'staging' || stage === 'production') && !expected) {
    throw new Error(`EXPECTED_AWS_ACCOUNT_ID es obligatorio para desplegar ${stage}`)
  }
  if (expected && !/^\d{12}$/.test(expected)) throw new Error('EXPECTED_AWS_ACCOUNT_ID debe contener 12 dígitos')
  if (expected && actualAccount !== expected) {
    throw new Error(`Cuenta AWS incorrecta: se esperaba ${expected} y las credenciales apuntan a ${actualAccount}`)
  }
}

export function readOutputs(stage: string): Record<string, Record<string, string>> {
  const file = path.join(root, 'outputs', `${stage}.json`)
  if (!fs.existsSync(file)) throw new Error(`No existe ${file}. Ejecuta primero npm run deploy:${stage}.`)
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, string>>
}

export function stackOutput(outputs: Record<string, Record<string, string>>, stackSuffix: string, key: string): string {
  const stack = Object.entries(outputs).find(([name]) => name.endsWith(stackSuffix))?.[1]
  const value = stack?.[key]
  if (!value) throw new Error(`No se encontró el output ${stackSuffix}.${key}`)
  return value
}
