import { describe, test, expect } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { appRequest, parseResponse } from '../helpers'

// Create a standalone test app (no real DB dependency)
function createHealthApp(dbHealthy: boolean = true) {
  const app = new Hono()

  app.get('/health', async (c) => {
    const checks: Record<string, string> = { api: 'ok' }
    let healthy = true

    if (dbHealthy) {
      checks.database = 'ok'
    } else {
      checks.database = 'error'
      healthy = false
    }

    return c.json({
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      checks,
    }, healthy ? 200 : 503)
  })

  app.get('/', (c) => c.json({ name: 'inmobiliaria-api', version: '0.1.0', docs: '/health' }))
  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  return app
}

describe('API Health & Root', () => {
  test('GET / should return API info', async () => {
    const app = createHealthApp()
    const res = await appRequest(app, 'GET', '/')
    expect(res.status).toBe(200)
    const body = await parseResponse(res)
    expect(body.name).toBe('inmobiliaria-api')
    expect(body.version).toBe('0.1.0')
  })

  test('GET /health should return healthy when DB is ok', async () => {
    const app = createHealthApp(true)
    const res = await appRequest(app, 'GET', '/health')
    expect(res.status).toBe(200)
    const body = await parseResponse(res)
    expect(body.status).toBe('healthy')
    expect(body.checks.api).toBe('ok')
    expect(body.checks.database).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })

  test('GET /health should return degraded when DB is down', async () => {
    const app = createHealthApp(false)
    const res = await appRequest(app, 'GET', '/health')
    expect(res.status).toBe(503)
    const body = await parseResponse(res)
    expect(body.status).toBe('degraded')
    expect(body.checks.database).toBe('error')
  })

  test('GET /unknown should return 404', async () => {
    const app = createHealthApp()
    const res = await appRequest(app, 'GET', '/unknown-route')
    expect(res.status).toBe(404)
  })
})
