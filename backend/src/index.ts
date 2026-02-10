import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { testConnection } from './database/connection'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/health', async (c) => {
  const checks: Record<string, string> = { api: 'ok' }
  let healthy = true

  try {
    await testConnection()
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
    healthy = false
  }

  const status = healthy ? 200 : 503
  return c.json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    checks,
  }, status)
})

app.get('/', (c) => {
  return c.json({
    name: 'inmobiliaria-api',
    version: '0.1.0',
    docs: '/health',
  })
})

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

const port = Number(process.env.PORT) || 3000
console.log(`🏠 Inmobiliaria API starting on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
