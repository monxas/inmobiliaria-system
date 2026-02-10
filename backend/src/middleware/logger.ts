import type { Context, Next } from 'hono'
import { logger } from '../lib/logger'

/**
 * Structured request logging middleware with correlation ID support.
 */
export const requestLogger = () => async (c: Context, next: Next) => {
  const start = performance.now()
  const method = c.req.method
  const path = c.req.path
  const requestId = c.get('requestId') as string | undefined

  await next()

  const duration = Math.round(performance.now() - start)
  const status = c.res.status

  const data: Record<string, unknown> = {
    method,
    path,
    status,
    durationMs: duration,
    ...(requestId && { requestId }),
  }

  if (status >= 500) {
    logger.error('request failed', data)
  } else if (status >= 400) {
    logger.warn('request error', data)
  } else {
    logger.info('request', data)
  }
}
