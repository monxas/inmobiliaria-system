import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { correlationId } from './middleware/correlation-id'
import { securityHeaders } from './middleware/security-headers'
import { rateLimiter, authRateLimiter } from './middleware/rate-limiter'
import { requestLogger } from './middleware/logger'
import { health, properties, clients, users, documents, auth } from './routes'
import { logger } from './lib/logger'

const app = new Hono()

// --- Global middleware stack (order matters) ---
app.use('*', correlationId())
app.use('*', securityHeaders())
app.use('*', rateLimiter())
app.use('*', requestLogger())
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}))

// Stricter rate limit on auth endpoints
app.use('/api/auth/*', authRateLimiter())

// --- Routes ---
app.route('/health', health)
app.route('/api/auth', auth)
app.route('/api/properties', properties)
app.route('/api/clients', clients)
app.route('/api/users', users)
app.route('/api/documents', documents)

app.get('/', (c) => {
  return c.json({
    name: 'inmobiliaria-api',
    version: process.env.APP_VERSION || '0.1.0',
    docs: '/health/detailed',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      clients: '/api/clients',
      users: '/api/users',
      documents: '/api/documents',
    }
  })
})

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

const port = Number(process.env.PORT) || 3000
logger.info('server starting', { port })

export default {
  port,
  fetch: app.fetch,
}
