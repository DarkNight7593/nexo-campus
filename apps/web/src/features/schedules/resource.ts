import type { ResourceDefinition } from '../resource-definitions.js'

export const schedulesResource: ResourceDefinition = {
  key: 'schedules', label: 'Horarios', singular: 'horario', icon: 'schedules', api: 'schedules', path: '/schedules',
  description: 'Sesiones por curso que también enriquecen el índice de búsqueda.',
  columns: [{ key: 'courseId', label: 'Curso' }, { key: 'days', label: 'Días' }, { key: 'startTime', label: 'Inicio' }, { key: 'endTime', label: 'Fin' }, { key: 'occupiedCount', label: 'Ocupados' }, { key: 'capacity', label: 'Capacidad' }, { key: 'status', label: 'Estado' }],
  form: [
    { key: 'courseId', label: 'ID del curso', placeholder: 'UUID del curso' },
    { key: 'days', label: 'Días', type: 'array', placeholder: 'MON, WED, FRI' },
    { key: 'startTime', label: 'Hora de inicio', type: 'time' },
    { key: 'endTime', label: 'Hora de fin', type: 'time' },
    { key: 'capacity', label: 'Capacidad', type: 'number' },
    { key: 'status', label: 'Estado', type: 'select', options: ['open', 'closed'] }
  ],
  createRoles: ['admin', 'instructor'],
  query: { key: 'courseId', label: 'Curso a consultar', placeholder: 'Pega el UUID del curso' },
  sample: { courseId: 'course-01', days: ['MON', 'WED'], startTime: '18:00', endTime: '20:00', capacity: 30, status: 'open' }
}
