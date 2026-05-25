type LogLevel = 'info' | 'warn' | 'error'

type LogPayload = Record<string, unknown>

function log(level: LogLevel, event: string, data?: LogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(entry))
}

export const logger = {
  info:  (event: string, data?: LogPayload) => log('info',  event, data),
  warn:  (event: string, data?: LogPayload) => log('warn',  event, data),
  error: (event: string, data?: LogPayload) => log('error', event, data),
}
