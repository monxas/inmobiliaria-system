import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { requestLogger } from '../../../src/middleware/logger'
import { appRequest } from '../../helpers'

describe('request logger middleware', () => {
  let stdoutData: string[]
  const originalWrite = process.stdout.write

  beforeEach(() => {
    stdoutData = []
    // Intercept stdout.write since the logger writes there
    process.stdout.write = ((chunk: any) => {
      stdoutData.push(String(chunk))
      return true
    }) as any
  })

  afterEach(() => {
    process.stdout.write = originalWrite
  })

  test('should log for successful requests', async () => {
    const app = new Hono()
    app.use('*', requestLogger())
    app.get('/test', (c) => c.json({ ok: true }))

    await appRequest(app, 'GET', '/test')
    const allOutput = stdoutData.join(' ')
    expect(allOutput).toContain('GET')
    expect(allOutput).toContain('/test')
  })

  test('should log for 4xx responses', async () => {
    const app = new Hono()
    app.use('*', requestLogger())
    app.get('/test', (c) => c.json({ error: 'not found' }, 404))

    await appRequest(app, 'GET', '/test')
    const allOutput = stdoutData.join(' ')
    expect(allOutput).toContain('404')
  })

  test('should include method and path', async () => {
    const app = new Hono()
    app.use('*', requestLogger())
    app.get('/hello', (c) => c.json({ ok: true }))

    await appRequest(app, 'GET', '/hello')
    const allOutput = stdoutData.join(' ')
    expect(allOutput).toContain('/hello')
    expect(allOutput).toContain('GET')
  })
})
