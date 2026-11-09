import { useEffect, useState } from 'react'
import type { AuthClaims, RuntimeConfig, UserRole } from '@cloud-learning/contracts'
import { loadRuntimeConfig } from './config/runtime-config.js'
import { finishSignIn, idToken, signInWithCognito, signOut, tokenClaims } from './lib/auth-client.js'
import { resources } from './features/resource-definitions.js'
import { AppLayout } from './layouts/AppLayout.js'
import { ResourcePanel } from './components/ResourcePanel.js'
import { OrganizationPanel } from './components/OrganizationPanel.js'
import { Overview } from './components/Overview.js'
import { Icon } from './components/Icon.js'

const roles = new Set<UserRole>(['admin', 'instructor', 'student'])

function authenticatedClaims(): AuthClaims | undefined {
  const raw = tokenClaims()
  if (!raw) return undefined
  const role = raw?.['custom:role']
  const userId = raw?.sub
  const tenantId = raw?.['custom:tenant_id']
  if (typeof role !== 'string' || !roles.has(role as UserRole) || typeof userId !== 'string' || typeof tenantId !== 'string') return undefined
  return { role: role as UserRole, userId, tenantId, email: typeof raw.email === 'string' ? raw.email : undefined }
}

export default function App() {
  const [config, setConfig] = useState<RuntimeConfig>()
  const [active, setActive] = useState('overview')
  const [error, setError] = useState('')
  useEffect(() => { void (async () => {
    try {
      const loaded = await loadRuntimeConfig()
      if (location.pathname === '/auth/callback') await finishSignIn(loaded)
      setConfig(loaded)
    } catch (reason) { setError((reason as Error).message) }
  })() }, [])

  if (error) return <div className="auth-page"><div className="auth-card error-card"><div className="brand-mark">!</div><span className="section-kicker">CONFIGURACIÓN</span><h1>No pudimos iniciar la aplicación</h1><p>{error}</p></div></div>
  if (!config) return <div className="auth-page"><div className="loading-brand"><div className="brand-mark">NC</div><span>Preparando tu espacio…</span></div></div>
  const configured = Boolean(config.auth.domain && config.auth.clientId && config.auth.redirectUri && config.auth.logoutUri)
  if (!idToken()) return <div className="auth-page"><div className="auth-card"><div className="auth-brand"><div className="brand-mark">NC</div><span>Nexo Campus</span></div><span className="section-kicker">ACCESO INSTITUCIONAL</span><h1>Gestiona tu operación académica.</h1><p>Accede de forma segura a los servicios y datos asignados a tu organización.</p><div className="auth-features"><span><Icon name="cloud"/>Disponibilidad en la nube</span><span><Icon name="organizations"/>Datos aislados por organización</span></div><button disabled={!configured} onClick={() => void signInWithCognito(config)}>{configured ? 'Iniciar sesión' : 'Servicio temporalmente no disponible'}</button></div></div>

  const claims = authenticatedClaims()
  if (!claims) return <div className="auth-page"><div className="auth-card error-card"><div className="brand-mark">!</div><span className="section-kicker">SESIÓN INVÁLIDA</span><h1>Faltan claims requeridas</h1><p>El token debe incluir <code>sub</code>, <code>custom:tenant_id</code> y <code>custom:role</code>.</p><button onClick={() => void signOut(config)}>Volver a ingresar</button></div></div>

  const availableResources = resources.filter((resource) => claims.role === 'admin' || resource.key !== 'organizations')
  const selected = availableResources.find((item) => item.key === active)
  return <AppLayout active={active} resources={availableResources} claims={claims} onSelect={setActive} onLogout={() => void signOut(config)}>
    {active === 'overview' && <Overview role={claims.role} tenantId={claims.tenantId} resources={availableResources} onSelect={setActive}/>}
    {active === 'organizations' && claims.role === 'admin' && <OrganizationPanel config={config} role={claims.role} tenantId={claims.tenantId}/>}
    {selected && selected.key !== 'organizations' && <ResourcePanel config={config} resource={selected} role={claims.role} claims={claims}/>}
  </AppLayout>
}
