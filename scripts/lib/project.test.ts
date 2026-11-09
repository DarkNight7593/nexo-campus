import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertAwsTarget } from './project.js'

afterEach(() => vi.unstubAllEnvs())

describe('AWS deployment target guard', () => {
  it('allows dev without an expected account', () => {
    vi.stubEnv('EXPECTED_AWS_ACCOUNT_ID', '')
    expect(() => assertAwsTarget('dev', '123456789012')).not.toThrow()
  })

  it('requires an explicit account for retained environments', () => {
    vi.stubEnv('EXPECTED_AWS_ACCOUNT_ID', '')
    expect(() => assertAwsTarget('staging', '123456789012')).toThrow(/obligatorio/)
    expect(() => assertAwsTarget('production', '123456789012')).toThrow(/obligatorio/)
  })

  it('rejects unknown stages and account mismatches', () => {
    vi.stubEnv('EXPECTED_AWS_ACCOUNT_ID', '123456789012')
    expect(() => assertAwsTarget('preview', '123456789012')).toThrow(/Stage AWS no permitido/)
    expect(() => assertAwsTarget('production', '999999999999')).toThrow(/Cuenta AWS incorrecta/)
  })
})
