import type { ResourceDefinition } from '../resource-definitions.js'

export const organizationsResource: ResourceDefinition = {
  key: 'organizations', label: 'Organización', singular: 'organización', icon: 'organizations', api: 'organizations', path: '/organizations',
  description: 'Identidad, dominio institucional y datos de la organización actual.',
  columns: [{ key: 'organizationId', label: 'Identificador' }, { key: 'name', label: 'Nombre' }, { key: 'domain', label: 'Dominio' }],
  form: [], createRoles: ['admin'], sample: {}
}
