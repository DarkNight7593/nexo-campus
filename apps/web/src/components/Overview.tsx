import type { UserRole } from '@cloud-learning/contracts'
import type { ResourceDefinition } from '../features/resource-definitions.js'
import { Icon } from './Icon.js'

const roleLabels: Record<UserRole, string> = { admin: 'Administrador', instructor: 'Instructor', student: 'Estudiante' }

export function Overview({ role, tenantId, resources, onSelect }: {
  role: UserRole
  tenantId: string
  resources: ResourceDefinition[]
  onSelect: (key: string) => void
}) {
  return <div className="overview-grid">
    <section className="hero-card">
      <div className="hero-copy">
        <span className="section-kicker">GESTIÓN CENTRALIZADA</span>
        <h2>{role === 'admin' ? 'Tu organización, en una sola vista.' : 'Tu actividad académica, siempre disponible.'}</h2>
        <p>{role === 'admin'
          ? 'Administra la identidad, los usuarios y la operación académica sin mezclar datos con otras organizaciones.'
          : 'Consulta cursos, horarios y matrículas disponibles dentro de tu organización.'}</p>
        <div className="hero-actions">
          <button onClick={() => onSelect(role === 'admin' ? 'organizations' : 'courses')}>
            {role === 'admin' ? 'Configurar organización' : 'Explorar cursos'}
          </button>
          <span className="tenant-code">Organización · {tenantId}</span>
        </div>
      </div>
      <div className="architecture-orbit" aria-label="Arquitectura activa">
        <div className="orbit-core"><Icon name="cloud" size={30}/><strong>Nexo</strong><small>activo</small></div>
        <span className="orbit-node node-a">API</span><span className="orbit-node node-b">λ</span><span className="orbit-node node-c">DB</span>
      </div>
    </section>

    <section className="metric-row" aria-label="Resumen del entorno">
      <article className="metric-card"><span className="metric-label">Rol activo</span><strong>{roleLabels[role]}</strong><small>Permisos derivados del JWT</small></article>
      <article className="metric-card"><span className="metric-label">Servicios</span><strong>5 APIs</strong><small>Dominios independientes</small></article>
      <article className="metric-card"><span className="metric-label">Organización</span><strong>{tenantId}</strong><small>Espacio de datos aislado</small></article>
    </section>

    <section className="quick-section">
      <div className="section-heading"><div><span className="section-kicker">ACCESOS RÁPIDOS</span><h2>Continúa trabajando</h2></div><span className="quiet-badge">{resources.length} módulos disponibles</span></div>
      <div className="module-grid">
        {resources.map((resource) => <button className="module-card" key={resource.key} onClick={() => onSelect(resource.key)}>
          <span className="module-icon"><Icon name={resource.icon}/></span>
          <span><strong>{resource.label}</strong><small>{resource.description}</small></span>
          <span className="arrow">→</span>
        </button>)}
      </div>
    </section>

    {role === 'admin' && <section className="admin-note">
      <span className="admin-note-icon"><Icon name="organizations"/></span>
      <div><strong>Administración de la organización</strong><p>Tu acceso está limitado a <code>{tenantId}</code>. El dominio institucional se registra aquí; la publicación DNS se gestiona durante el alta de la organización.</p></div>
    </section>}
  </div>
}
