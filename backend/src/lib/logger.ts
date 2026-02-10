/**
 * Structured JSON logger with configurable levels.
 * Lightweight pino-style implementation (zero dependencies).
 */

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 } as const
type LogLevel = keyof typeof LOG_LEVELS

const currentLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) || 'info'
const currentLevelValue = LOG_LEVELS[currentLevel] ?? 20
const prettyPrint = process.env['LOG_FORMAT'] === 'pretty'

interface LogEntry {
  level: LogLevel
  msg: string
  timestamp: string
  [key: string]: unknown
}

function write(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < currentLevelValue) return

  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...data,
  }

  const output = prettyPrint
    ? `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)} ${msg}${data ? ' ' + JSON.stringify(data) : ''}`
    : JSON.stringify(entry)

  if (LOG_LEVELS[level] >= LOG_LEVELS.error) {
    process.stderr.write(output + '\n')
  } else {
    process.stdout.write(output + '\n')
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => write('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => write('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write('error', msg, data),
  fatal: (msg: string, data?: Record<string, unknown>) => write('fatal', msg, data),

  /** Create a child logger with bound context fields */
  child: (context: Record<string, unknown>) => ({
    debug: (msg: string, data?: Record<string, unknown>) => write('debug', msg, { ...context, ...data }),
    info: (msg: string, data?: Record<string, unknown>) => write('info', msg, { ...context, ...data }),
    warn: (msg: string, data?: Record<string, unknown>) => write('warn', msg, { ...context, ...data }),
    error: (msg: string, data?: Record<string, unknown>) => write('error', msg, { ...context, ...data }),
    fatal: (msg: string, data?: Record<string, unknown>) => write('fatal', msg, { ...context, ...data }),
  }),
}

export type Logger = typeof logger
