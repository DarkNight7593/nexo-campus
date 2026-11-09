import type { ResourceDefinition } from '../resource-definitions.js'

export const coursesResource: ResourceDefinition = {
  key: 'courses', label: 'Cursos', singular: 'curso', icon: 'courses', api: 'courses', path: '/courses',
  description: 'Catálogo académico de la organización, disponible para búsqueda avanzada.',
  columns: [{ key: 'name', label: 'Curso' }, { key: 'instructorId', label: 'Instructor' }, { key: 'startDate', label: 'Inicio' }, { key: 'price', label: 'Precio' }],
  form: [
    { key: 'instructorId', label: 'ID del instructor', placeholder: 'Sub de Cognito' },
    { key: 'name', label: 'Nombre del curso', placeholder: 'Arquitectura Serverless' },
    { key: 'description', label: 'Descripción', placeholder: 'Descripción breve del contenido' },
    { key: 'startDate', label: 'Fecha de inicio', type: 'date' },
    { key: 'endDate', label: 'Fecha de fin', type: 'date' },
    { key: 'price', label: 'Precio', type: 'number' }
  ],
  createRoles: ['admin', 'instructor'],
  sample: { instructorId: 'instructor-01', name: 'Gestión de proyectos', description: 'Programa académico institucional', startDate: '2026-01-01', endDate: '2026-12-31', price: 99 }
}
