import type { Context, Next } from 'hono'

export const requestLogger = () => async (c: Context, next: Next) => {
  const start = performance.now()
  const method = c.req.method
  const path = c.req.path

  await next()

  const duration = (performance.now() - start).toFixed(1)
  const status = c.res.status
  const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO'

  console.log(`[${level}] ${method} ${path} ${status} ${duration}ms`)
}
