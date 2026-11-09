import type { ReactNode } from 'react'
import type { AuthClaims, UserRole } from '@cloud-learning/contracts'
import type { ResourceDefinition } from '../features/resource-definitions.js'
import { Icon } from '../components/Icon.js'

const roleLabels: Record<UserRole, string> = { admin: 'Administrador', instructor: 'Instructor', student: 'Estudiante' }

export function AppLayout({ active, resources, claims, onSelect, onLogout, children }: {
  active: string
  resources: ResourceDefinition[]
  claims: AuthClaims
  onSelect: (key: string) => void
  onLogout: () => void
  children: ReactNode
}) {
  const initials = (claims.email ?? claims.userId).split(/[@.\s_-]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">NC</div><div><strong>Nexo Campus</strong><small>Gestión académica</small></div></div>
      <div className="environment-card"><span className="pulse-dot"/><div><small>ESTADO DEL SISTEMA</small><strong>Operativo</strong></div><span>Online</span></div>
      <nav aria-label="Navegación principal">
        <span className="nav-label">ESPACIO DE TRABAJO</span>
        <button className={active === 'overview' ? 'active' : ''} onClick={() => onSelect('overview')}><Icon name="overview"/><span>Resumen</span></button>
        {resources.map((item) => <button key={item.key} className={active === item.key ? 'active' : ''} onClick={() => onSelect(item.key)}><Icon name={item.icon}/><span>{item.key === 'users' && claims.role !== 'admin' ? 'Mi perfil' : item.label}</span></button>)}
      </nav>
      <div className="sidebar-user"><div className="avatar">{initials || 'U'}</div><div><strong>{claims.email ?? 'Usuario autenticado'}</strong><small>{roleLabels[claims.role]}</small></div><button onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="logout"/></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><span className="breadcrumbs">Nexo Campus <b>/</b> {active === 'overview' ? 'Resumen' : resources.find((item) => item.key === active)?.label}</span><h1>{active === 'overview' ? `Hola, ${roleLabels[claims.role].toLocaleLowerCase()}` : resources.find((item) => item.key === active)?.label}</h1></div><div className="topbar-meta"><span className="connection-pill"><i/>Sistema operativo</span><span className="tenant-pill">{claims.tenantId}</span></div></header>
      <div className="content-area">{children}</div>
    </main>
  </div>
}
