import type { ResourceDefinition } from '../resource-definitions.js'

export const usersResource: ResourceDefinition = {
  key: 'users', label: 'Usuarios', singular: 'perfil', icon: 'users', api: 'users', path: '/profiles',
  description: 'Perfiles y roles vinculados a las identidades de Cognito.',
  columns: [{ key: 'fullName', label: 'Nombre' }, { key: 'email', label: 'Correo' }, { key: 'role', label: 'Rol' }, { key: 'documentNumber', label: 'Documento' }],
  form: [
    { key: 'fullName', label: 'Nombre completo', placeholder: 'María Torres' },
    { key: 'email', label: 'Correo', type: 'email', placeholder: 'maria@organizacion.edu' },
    { key: 'role', label: 'Rol', type: 'select', options: ['admin', 'instructor', 'student'] },
    { key: 'documentNumber', label: 'Documento', placeholder: 'DNI o identificación' }
  ],
  createRoles: ['admin', 'instructor', 'student'],
  sample: { fullName: 'Nuevo usuario', email: 'usuario@organizacion.edu', role: 'student', documentNumber: '00000000' }
}
