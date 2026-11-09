import type { ResourceDefinition } from '../resource-definitions.js'

export const purchasesResource: ResourceDefinition = {
  key: 'purchases', label: 'Matrículas', singular: 'matrícula', icon: 'purchases', api: 'purchases', path: '/purchases',
  description: 'Reservas con precio calculado por el backend y cupos protegidos contra sobreventa.',
  columns: [{ key: 'courseId', label: 'Curso' }, { key: 'userId', label: 'Usuario' }, { key: 'status', label: 'Estado' }, { key: 'amount', label: 'Importe' }],
  form: [
    { key: 'courseId', label: 'ID del curso', placeholder: 'UUID del curso' },
    { key: 'scheduleId', label: 'ID del horario', placeholder: 'UUID del horario' }
  ],
  createRoles: ['admin', 'instructor', 'student'],
  sample: { courseId: 'course-01', scheduleId: 'schedule-01' }
}
