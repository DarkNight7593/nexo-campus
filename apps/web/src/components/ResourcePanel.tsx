import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthClaims, RuntimeConfig, UserRole } from '@cloud-learning/contracts'
import { apiRequest } from '../lib/api-client.js'
import type { ResourceDefinition, ResourceFormField } from '../features/resource-definitions.js'
import { Icon } from './Icon.js'

type Item = Record<string, unknown>

function visibleValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(value)
  return String(value ?? '—')
}

function inputValue(value: unknown, type: ResourceFormField['type']): string {
  if (type === 'array' && Array.isArray(value)) return value.join(', ')
  return String(value ?? '')
}

function coerce(value: string, type: ResourceFormField['type']): unknown {
  if (type === 'number') return Number(value)
  if (type === 'array') return value.split(',').map((part) => part.trim()).filter(Boolean)
  return value
}

export function ResourcePanel({ config, resource, role, claims }: { config: RuntimeConfig; resource: ResourceDefinition; role: UserRole; claims: AuthClaims }) {
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState<Item>(resource.sample)
  const [queryValue, setQueryValue] = useState('')
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextToken, setNextToken] = useState<string>()
  const [composerOpen, setComposerOpen] = useState(false)
  const [createRequestId, setCreateRequestId] = useState(() => crypto.randomUUID())
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string }>()
  const alreadyHasProfile = resource.key === 'users' && items.some((item) => item.userId === claims.userId)
  const canCreate = resource.createRoles.includes(role) && (resource.key !== 'users' || (!loading && !alreadyHasProfile))

  function listPath(): string | undefined {
    if (resource.key === 'users' && role !== 'admin') return '/profiles/me'
    if (resource.query) return queryValue.trim() ? `${resource.path}?${resource.query.key}=${encodeURIComponent(queryValue.trim())}` : undefined
    return resource.path
  }

  async function load(options: { append?: boolean; token?: string } = {}) {
    const basePath = listPath()
    const path = basePath && options.token
      ? `${basePath}${basePath.includes('?') ? '&' : '?'}limit=20&nextToken=${encodeURIComponent(options.token)}`
      : basePath
    if (!path) { setItems([]); return }
    if (options.append) setLoadingMore(true)
    else setLoading(true)
    setNotice(undefined)
    try {
      const result = await apiRequest<Item | Item[] | { items: Item[]; nextToken?: string }>(config, resource.api, path)
      if (Array.isArray(result)) {
        setItems(result)
        setNextToken(undefined)
      } else if ('items' in result && Array.isArray(result.items)) {
        const page = result as { items: Item[]; nextToken?: string }
        setItems((current) => options.append ? [...current, ...page.items] : page.items)
        setNextToken(page.nextToken)
      } else {
        setItems([result])
        setNextToken(undefined)
      }
    } catch (reason) {
      if (!options.append) setItems([])
      setNotice({ tone: 'error', text: (reason as Error).message })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const prepared = { ...resource.sample }
    if (resource.key === 'users') prepared.role = role
    if (resource.key === 'courses' && role === 'instructor') prepared.instructorId = claims.userId
    setDraft(prepared)
    setFilter('')
    setQueryValue('')
    setComposerOpen(false)
    setNotice(undefined)
    setNextToken(undefined)
    setCreateRequestId(crypto.randomUUID())
    if (!resource.query) void load()
  }, [resource.key, role])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setNotice(undefined)
    try {
      await apiRequest(config, resource.api, resource.path, {
        method: 'POST',
        body: JSON.stringify(draft),
        headers: resource.key === 'purchases' ? { 'Idempotency-Key': createRequestId } : undefined
      })
      if (resource.key === 'purchases') setCreateRequestId(crypto.randomUUID())
      setNotice({ tone: 'success', text: `Registro creado correctamente en ${resource.label.toLocaleLowerCase()}.` })
      setComposerOpen(false)
      if (resource.query && typeof draft.courseId === 'string') {
        setQueryValue(draft.courseId)
        const result = await apiRequest<{ items: Item[] }>(config, resource.api, `${resource.path}?${resource.query.key}=${encodeURIComponent(draft.courseId)}`)
        setItems(result.items)
      } else await load()
    } catch (reason) { setNotice({ tone: 'error', text: (reason as Error).message }) }
    finally { setCreating(false) }
  }

  const filtered = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase()
    if (!term) return items
    return items.filter((item) => Object.values(item).some((value) => visibleValue(value).toLocaleLowerCase().includes(term)))
  }, [items, filter])

  const resourceLabel = resource.key === 'users' && role !== 'admin' ? 'Mi perfil' : resource.label
  return <section className="page-stack">
    <div className="page-title">
      <div><span className="section-kicker">SERVICIO INDEPENDIENTE</span><h2>{resourceLabel}</h2><p>{resource.description}</p></div>
      <div className="page-actions">
        <button className="icon-button" onClick={() => void load()} aria-label={`Actualizar ${resource.label}`} disabled={loading || Boolean(resource.query && !queryValue)}><Icon name="refresh"/></button>
        {canCreate && <button onClick={() => setComposerOpen(true)}><Icon name="plus"/>Nuevo {resource.singular}</button>}
      </div>
    </div>

    {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

    <section className="data-card">
      <div className="table-toolbar">
        {resource.query ? <label className="query-control"><span>{resource.query.label}</span><div><input value={queryValue} onChange={(event) => setQueryValue(event.target.value)} placeholder={resource.query.placeholder}/><button onClick={() => void load()} disabled={!queryValue.trim()}>Consultar</button></div></label> : <div className="search-box"><Icon name="search"/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Buscar en ${resourceLabel.toLocaleLowerCase()}…`}/></div>}
        <span className="result-count">{loading ? 'Consultando…' : `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>{resource.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={resource.columns.length}><div className="table-loading"><i/><i/><i/></div></td></tr>}
            {!loading && filtered.map((item, index) => <tr key={String(item.organizationId ?? item.userId ?? item.courseId ?? item.scheduleId ?? item.purchaseId ?? index)}>{resource.columns.map((column) => <td key={column.key}>{column.key === 'status' || column.key === 'role' ? <span className={`value-chip ${String(item[column.key] ?? '')}`}>{visibleValue(item[column.key])}</span> : visibleValue(item[column.key])}</td>)}</tr>)}
            {!loading && filtered.length === 0 && <tr><td colSpan={resource.columns.length}><div className="empty-state"><span className="empty-icon"><Icon name={resource.icon}/></span><strong>{resource.query && !queryValue ? 'Selecciona primero un curso' : 'No hay registros para mostrar'}</strong><p>{resource.query && !queryValue ? 'Usa el identificador del curso para consultar sus horarios.' : 'Los nuevos registros aparecerán aquí.'}</p></div></td></tr>}
          </tbody>
        </table>
      </div>
      {nextToken && <div className="table-footer"><button className="secondary-button" onClick={() => void load({ append: true, token: nextToken })} disabled={loadingMore}>{loadingMore ? 'Cargando…' : 'Cargar más registros'}</button></div>}
    </section>

    {composerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposerOpen(false) }}>
      <form className="composer-modal" onSubmit={(event) => void create(event)}>
        <div className="composer-head"><div><span className="section-kicker">NUEVO REGISTRO</span><h3>Crear {resource.singular}</h3><p>Se guardará en la organización <code>{claims.tenantId}</code>.</p></div><button type="button" className="icon-button" onClick={() => setComposerOpen(false)} aria-label="Cerrar"><Icon name="close"/></button></div>
        <div className="form-grid">{resource.form.map((field) => {
          const locked = (resource.key === 'users' && field.key === 'role') || (resource.key === 'courses' && field.key === 'instructorId' && role === 'instructor')
          return <label key={field.key}>{field.label}{field.type === 'select'
            ? <select value={inputValue(draft[field.key], field.type)} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} disabled={locked}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
            : <input type={field.type === 'array' ? 'text' : field.type ?? 'text'} value={inputValue(draft[field.key], field.type)} onChange={(event) => setDraft({ ...draft, [field.key]: coerce(event.target.value, field.type) })} placeholder={field.placeholder} disabled={locked} required/>}</label>
        })}</div>
        <div className="composer-footer"><button type="button" className="secondary-button" onClick={() => setComposerOpen(false)}>Cancelar</button><button type="submit" disabled={creating}>{creating ? 'Creando…' : `Crear ${resource.singular}`}</button></div>
      </form>
    </div>}
  </section>
}
