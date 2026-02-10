import type { Context, Next } from 'hono'
import { randomUUID } from 'crypto'

const HEADER = 'X-Request-ID'

/**
 * Adds a correlation/request ID to every request.
 * Uses incoming X-Request-ID if present, otherwise generates one.
 */
export function correlationId() {
  return async (c: Context, next: Next) => {
    const id = c.req.header(HEADER) || randomUUID()
    c.set('requestId', id)
    c.header(HEADER, id)
    await next()
  }
}
