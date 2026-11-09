import type { RuntimeConfig } from '@cloud-learning/contracts'

const keys = { access: 'cl_access_token', id: 'cl_id_token', verifier: 'cl_pkce_verifier', state: 'cl_oauth_state' }

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function sha256(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

export async function signInWithCognito(config: RuntimeConfig): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)))
  const state = crypto.randomUUID()
  sessionStorage.setItem(keys.verifier, verifier)
  sessionStorage.setItem(keys.state, state)
  const query = new URLSearchParams({
    client_id: config.auth.clientId, response_type: 'code', scope: 'openid email profile',
    redirect_uri: config.auth.redirectUri, state, code_challenge_method: 'S256', code_challenge: await sha256(verifier)
  })
  location.assign(`${config.auth.domain}/oauth2/authorize?${query}`)
}

export async function finishSignIn(config: RuntimeConfig): Promise<void> {
  const query = new URLSearchParams(location.search)
  const code = query.get('code')
  if (!code || query.get('state') !== sessionStorage.getItem(keys.state)) throw new Error('Respuesta OAuth inválida')
  const response = await fetch(`${config.auth.domain}/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.auth.clientId, code, redirect_uri: config.auth.redirectUri, code_verifier: sessionStorage.getItem(keys.verifier) ?? '' })
  })
  if (!response.ok) throw new Error('Cognito no pudo intercambiar el código de autorización')
  const tokens = await response.json() as { access_token: string; id_token: string }
  sessionStorage.setItem(keys.access, tokens.access_token)
  sessionStorage.setItem(keys.id, tokens.id_token)
  sessionStorage.removeItem(keys.verifier)
  sessionStorage.removeItem(keys.state)
  history.replaceState({}, '', '/')
}

function decodeClaims(token: string): Record<string, unknown> | undefined {
  const payload = token.split('.')[1]
  if (!payload) return undefined
  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/')
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as Record<string, unknown>
  } catch { return undefined }
}

export function idToken(): string | null {
  const token = sessionStorage.getItem(keys.id)
  if (!token) return null
  const claims = decodeClaims(token)
  if (!claims || typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) {
    sessionStorage.removeItem(keys.access)
    sessionStorage.removeItem(keys.id)
    return null
  }
  return token
}

export function tokenClaims(): Record<string, unknown> | undefined {
  const token = idToken()
  if (!token) return undefined
  return decodeClaims(token)
}

export async function signOut(config: RuntimeConfig): Promise<void> {
  sessionStorage.clear()
  const query = new URLSearchParams({ client_id: config.auth.clientId, logout_uri: config.auth.logoutUri })
  location.assign(`${config.auth.domain}/logout?${query}`)
}
