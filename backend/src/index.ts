import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { correlationId } from './middleware/correlation-id'
import { securityHeaders } from './middleware/security-headers'
import { rateLimiter, authRateLimiter } from './middleware/rate-limiter'
import { requestLogger } from './middleware/logger'
import { health } from './routes/health'
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

app.get('/', (c) => {
  return c.json({
    name: 'inmobiliaria-api',
    version: process.env.APP_VERSION || '0.1.0',
    docs: '/health/detailed',
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
