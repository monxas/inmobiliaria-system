/**
 * @fileoverview Application entry point
 * Level 1 Foundation - Optimized startup
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { correlationId } from './middleware/correlation-id'
import { securityHeaders } from './middleware/security-headers'
import { rateLimiter, authRateLimiter } from './middleware/rate-limiter'
import { requestLogger } from './middleware/logger'
import { errorHandler } from './middleware/errors'
import { health, properties, clients, users, documents, auth, calendar, events, communications } from './routes'
import * as icalService from './services/ical-export.service'
import { startScheduler } from './services/notification-orchestrator.service'
import { logger } from './lib/logger'
import { container } from './lib/container'
import { loadConfig } from './config'

// =============================================================================
// Configuration Validation (fail-fast)
// =============================================================================

const startTime = performance.now()
const config = loadConfig()

logger.info('Configuration loaded', {
  env: config.NODE_ENV,
  port: config.PORT,
  logLevel: config.LOG_LEVEL,
})

// =============================================================================
// Hono Application
// =============================================================================

const app = new Hono()

// --- Global middleware stack (order matters) ---
// 1. Error handling (wrap everything)
app.use('*', errorHandler())

// 2. Request tracking
app.use('*', correlationId())

// 3. Security headers
app.use('*', securityHeaders())

// 4. Rate limiting
app.use('*', rateLimiter())

// 5. Request logging
app.use('*', requestLogger())

// 6. CORS
app.use('*', cors({
  origin: config.CORS_ORIGINS.split(',').map(o => o.trim()),
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
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
app.route('/api/calendar', calendar)
app.route('/api/communications', communications)

// Public iCal feed (no auth - token in URL)
app.get('/api/communications/calendar/feed/:token', async (c) => {
  const token = c.req.param('token')
  // Simple token decode (userId:timestamp in base64url)
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const userId = Number(decoded.split(':')[0])
    if (!userId || isNaN(userId)) {
      return c.json({ success: false, error: { message: 'Invalid feed token' } }, 401)
    }
    const ics = await icalService.generateUserFeed(userId)
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch {
    return c.json({ success: false, error: { message: 'Feed generation failed' } }, 500)
  }
})
app.route('/api/events', events)

// --- Root endpoint ---
app.get('/', (c) => {
  return c.json({
    name: 'inmobiliaria-api',
    version: config.APP_VERSION,
    status: container.isReady() ? 'ready' : 'starting',
    docs: '/health/detailed',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      clients: '/api/clients',
      users: '/api/users',
      documents: '/api/documents',
      calendar: '/api/calendar',
      events: '/api/events',
    }
  })
})

// --- 404 handler ---
app.notFound((c) => {
  return c.json({ 
    success: false,
    error: {
      message: 'Not found',
      code: 'NOT_FOUND',
      statusCode: 404,
      path: c.req.path,
    }
  }, 404)
})

// =============================================================================
// Server Startup
// =============================================================================

async function bootstrap(): Promise<void> {
  try {
    // Initialize container (verify database connection)
    await container.initialize()
    
    // Start communication scheduler (processes reminders every minute)
    startScheduler()
    
    const startupTime = Math.round(performance.now() - startTime)
    
    logger.info('Server ready', {
      port: config.PORT,
      env: config.NODE_ENV,
      startupMs: startupTime,
      version: config.APP_VERSION,
    })
  } catch (error) {
    logger.fatal('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  }
}

// Initialize in background (non-blocking) - void operator indicates intentional fire-and-forget
void bootstrap()

// =============================================================================
// Export for Bun
// =============================================================================

export default {
  port: config.PORT,
  fetch: app.fetch,
}
