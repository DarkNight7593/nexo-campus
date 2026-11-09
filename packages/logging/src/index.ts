export interface LogContext {
  service: string
  requestId?: string
  tenantId?: string
  userId?: string
  [key: string]: unknown
}

function write(level: 'INFO' | 'WARN' | 'ERROR', message: string, context: LogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  }
  const line = JSON.stringify(entry)
  if (level === 'ERROR') console.error(line)
  else if (level === 'WARN') console.warn(line)
  else console.info(line)
}

export const logger = {
  info: (message: string, context: LogContext) => write('INFO', message, context),
  warn: (message: string, context: LogContext) => write('WARN', message, context),
  error: (message: string, context: LogContext) => write('ERROR', message, context)
}
