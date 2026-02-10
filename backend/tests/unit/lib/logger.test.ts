/**
 * Logger Unit Tests — Full coverage including child loggers and error output
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

// We need to test logger in isolation with different env configs
describe('Logger', () => {
  let originalEnv: Record<string, string | undefined>
  let stderrData: string[]
  let stdoutData: string[]
  const originalStdout = process.stdout.write
  const originalStderr = process.stderr.write

  beforeEach(() => {
    originalEnv = {
      LOG_LEVEL: process.env.LOG_LEVEL,
      LOG_FORMAT: process.env.LOG_FORMAT,
    }
    stderrData = []
    stdoutData = []
    
    process.stdout.write = ((chunk: any) => {
      stdoutData.push(String(chunk))
      return true
    }) as any
    
    process.stderr.write = ((chunk: any) => {
      stderrData.push(String(chunk))
      return true
    }) as any
  })

  afterEach(() => {
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
    Object.entries(originalEnv).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    })
    // Clear module cache to reload logger with new env
    delete require.cache[require.resolve('../../../src/lib/logger')]
  })

  test('should write error logs to stderr', async () => {
    delete process.env.LOG_LEVEL
    delete process.env.LOG_FORMAT
    
    // Dynamic import to pick up clean env
    const { logger } = await import('../../../src/lib/logger')
    
    logger.error('Test error message', { errorCode: 'ERR001' })
    
    const allStderr = stderrData.join('')
    expect(allStderr).toContain('Test error message')
    expect(allStderr).toContain('error')
  })

  test('should write fatal logs to stderr', async () => {
    delete process.env.LOG_LEVEL
    
    const { logger } = await import('../../../src/lib/logger')
    
    logger.fatal('System crash', { code: 'FATAL' })
    
    const allStderr = stderrData.join('')
    expect(allStderr).toContain('System crash')
    expect(allStderr).toContain('fatal')
  })

  test('should write info logs to stdout', async () => {
    delete process.env.LOG_LEVEL
    
    const { logger } = await import('../../../src/lib/logger')
    
    logger.info('Info message')
    
    const allStdout = stdoutData.join('')
    expect(allStdout).toContain('Info message')
  })

  test('should write debug logs when LOG_LEVEL=debug', async () => {
    process.env.LOG_LEVEL = 'debug'
    
    const { logger } = await import('../../../src/lib/logger')
    
    logger.debug('Debug message')
    
    const allStdout = stdoutData.join('')
    expect(allStdout).toContain('Debug message')
  })

  test('should skip debug logs when LOG_LEVEL=info', async () => {
    process.env.LOG_LEVEL = 'info'
    
    const { logger } = await import('../../../src/lib/logger')
    
    logger.debug('Should not appear')
    
    const allStdout = stdoutData.join('')
    expect(allStdout).not.toContain('Should not appear')
  })

  test('should use pretty format when LOG_FORMAT=pretty', async () => {
    process.env.LOG_FORMAT = 'pretty'
    delete process.env.LOG_LEVEL
    
    const { logger } = await import('../../../src/lib/logger')
    
    logger.info('Pretty message', { key: 'value' })
    
    const allStdout = stdoutData.join('')
    expect(allStdout).toContain('[')  // Pretty format has brackets
    expect(allStdout).toContain('INFO')
  })

  test('should create child logger with bound context', async () => {
    delete process.env.LOG_LEVEL
    
    const { logger } = await import('../../../src/lib/logger')
    
    const childLogger = logger.child({ requestId: 'req-123', userId: 42 })
    childLogger.info('Child log message')
    
    const allStdout = stdoutData.join('')
    expect(allStdout).toContain('Child log message')
    expect(allStdout).toContain('req-123')
    expect(allStdout).toContain('42')
  })

  test('child logger should merge context with message data', async () => {
    delete process.env.LOG_LEVEL
    
    const { logger } = await import('../../../src/lib/logger')
    
    const childLogger = logger.child({ requestId: 'req-456' })
    childLogger.warn('Warning with extra', { extraField: 'extra' })
    
    const allStdout = stdoutData.join('')
    expect(allStdout).toContain('req-456')
    expect(allStdout).toContain('extraField')
    expect(allStdout).toContain('extra')
  })

  test('child logger should support all log levels', async () => {
    process.env.LOG_LEVEL = 'debug'
    
    const { logger } = await import('../../../src/lib/logger')
    
    const child = logger.child({ component: 'test' })
    
    child.debug('Debug from child')
    child.info('Info from child')
    child.warn('Warn from child')
    child.error('Error from child')
    child.fatal('Fatal from child')
    
    const allOutput = stdoutData.join('') + stderrData.join('')
    expect(allOutput).toContain('Debug from child')
    expect(allOutput).toContain('Info from child')
    expect(allOutput).toContain('Warn from child')
    expect(allOutput).toContain('Error from child')
    expect(allOutput).toContain('Fatal from child')
  })

  test('should include timestamp in log entries', async () => {
    delete process.env.LOG_FORMAT
    delete process.env.LOG_LEVEL
    
    const { logger } = await import('../../../src/lib/logger')
    
    logger.info('Timestamped message')
    
    const allStdout = stdoutData.join('')
    // ISO timestamp format check
    expect(allStdout).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
