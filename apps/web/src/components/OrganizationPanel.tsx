import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Organization, RuntimeConfig, UserRole } from '@cloud-learning/contracts'
import { apiRequest } from '../lib/api-client.js'
import { Icon } from './Icon.js'

type OrganizationDraft = Pick<Organization, 'organizationId' | 'name' | 'domain' | 'email' | 'description'>

const emptyDraft = (tenantId: string): OrganizationDraft => ({ organizationId: tenantId, name: '', domain: '', email: '', description: '' })

export function OrganizationPanel({ config, role, tenantId }: { config: RuntimeConfig; role: UserRole; tenantId: string }) {
  const [organization, setOrganization] = useState<Organization>()
  const [draft, setDraft] = useState<OrganizationDraft>(() => emptyDraft(tenantId))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string }>()
  const isAdmin = role === 'admin'

  async function load() {
    setLoading(true)
    setNotice(undefined)
    try {
      const found = isAdmin
        ? (await apiRequest<{ items: Organization[] }>(config, 'organizations', '/organizations')).items[0]
        : await apiRequest<Organization>(config, 'organizations', `/organizations/${encodeURIComponent(tenantId)}`)
      setOrganization(found)
      setDraft(found ? { organizationId: found.organizationId, name: found.name, domain: found.domain ?? '', email: found.email ?? '', description: found.description ?? '' } : emptyDraft(tenantId))
    } catch (reason) {
      setNotice({ tone: 'error', text: (reason as Error).message })
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [tenantId, role])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    setNotice(undefined)
    const optional = (value: string | undefined) => value?.trim() || undefined
    try {
      const body = organization
        ? { name: draft.name.trim(), domain: optional(draft.domain), email: optional(draft.email), description: optional(draft.description) }
        : { organizationId: tenantId, name: draft.name.trim(), domain: optional(draft.domain), email: optional(draft.email), description: optional(draft.description) }
      const saved = await apiRequest<Organization>(config, 'organizations', organization ? `/organizations/${encodeURIComponent(tenantId)}` : '/organizations', {
        method: organization ? 'PATCH' : 'POST', body: JSON.stringify(body)
      })
      setOrganization(saved)
      setNotice({ tone: 'success', text: organization ? 'Organización actualizada.' : 'Perfil institucional completado.' })
    } catch (reason) { setNotice({ tone: 'error', text: (reason as Error).message }) }
    finally { setSaving(false) }
  }

  return <section className="page-stack">
    <div className="page-title"><div><span className="section-kicker">ADMINISTRACIÓN INSTITUCIONAL</span><h2>Organización</h2><p>Identidad, contacto y dominio de tu organización.</p></div><button className="icon-button" onClick={() => void load()} aria-label="Actualizar organización"><Icon name="refresh"/></button></div>
    {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}
    <div className="organization-grid">
      <article className="organization-card">
        <div className="organization-badge"><Icon name="organizations" size={28}/></div>
        {loading ? <div className="skeleton-lines"><i/><i/><i/></div> : <>
          <span className="section-kicker">IDENTIDAD ACTUAL</span>
          <h3>{organization?.name ?? 'Organización pendiente'}</h3>
          <p>{organization?.description ?? 'Completa el perfil institucional de tu organización.'}</p>
          <dl className="definition-list">
            <div><dt>Identificador interno</dt><dd><code>{tenantId}</code></dd></div>
            <div><dt>Dominio registrado</dt><dd>{organization?.domain ?? 'Sin configurar'}</dd></div>
            <div><dt>Contacto</dt><dd>{organization?.email ?? 'Sin configurar'}</dd></div>
          </dl>
          <div className="info-strip">El dominio identifica a la institución. La activación de DNS y certificados se realiza durante el proceso de alta.</div>
        </>}
      </article>
      <form className="form-card" onSubmit={(event) => void save(event)}>
        <div className="form-card-head"><div><span className="section-kicker">{organization ? 'CONFIGURACIÓN' : 'PRIMERA CONFIGURACIÓN'}</span><h3>{organization ? 'Editar datos' : 'Completar perfil'}</h3></div><span className={`role-chip ${isAdmin ? 'admin' : ''}`}>{isAdmin ? 'Administrador' : 'Sólo lectura'}</span></div>
        <label>Identificador asignado<input value={tenantId} disabled/></label>
        <label>Nombre institucional<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} disabled={!isAdmin} minLength={2} required placeholder="Universidad o empresa"/></label>
        <div className="field-row"><label>Dominio<input value={draft.domain ?? ''} onChange={(event) => setDraft({ ...draft, domain: event.target.value })} disabled={!isAdmin} placeholder="organizacion.edu"/></label><label>Correo de contacto<input type="email" value={draft.email ?? ''} onChange={(event) => setDraft({ ...draft, email: event.target.value })} disabled={!isAdmin} placeholder="admin@organizacion.edu"/></label></div>
        <label>Descripción<textarea value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} disabled={!isAdmin} maxLength={500} placeholder="Describe brevemente esta organización"/></label>
        {isAdmin && <button type="submit" disabled={saving || loading}>{saving ? 'Guardando…' : organization ? 'Guardar cambios' : 'Guardar perfil institucional'}</button>}
      </form>
    </div>
  </section>
}
