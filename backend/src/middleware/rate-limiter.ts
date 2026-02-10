import type { Context, Next } from 'hono'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * In-memory rate limiter. For multi-instance deployments, replace with Redis-based store.
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    // Cleanup expired entries every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key)
    if (entry && Date.now() > entry.resetAt) {
      this.store.delete(key)
      return undefined
    }
    return entry
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now()
    const existing = this.get(key)
    if (existing) {
      existing.count++
      return existing
    }
    const entry: RateLimitEntry = { count: 1, resetAt: now + windowMs }
    this.store.set(key, entry)
    return entry
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) this.store.delete(key)
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

const globalStore = new RateLimitStore()

function getClientIP(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

export function rateLimiter(config?: Partial<RateLimitConfig>) {
  const windowMs = config?.windowMs ?? (Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000)
  const maxRequests = config?.maxRequests ?? (Number(process.env.RATE_LIMIT_MAX) || 100)
  const message = config?.message ?? 'Too many requests, please try again later'

  return async (c: Context, next: Next) => {
    const ip = getClientIP(c)
    const key = `general:${ip}`
    const entry = globalStore.increment(key, windowMs)

    c.header('X-RateLimit-Limit', String(maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > maxRequests) {
      return c.json({ error: message }, 429)
    }

    await next()
  }
}

/**
 * Stricter rate limiter for auth endpoints (login, register, etc.)
 */
export function authRateLimiter() {
  const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60_000
  const maxRequests = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10

  return async (c: Context, next: Next) => {
    const ip = getClientIP(c)
    const key = `auth:${ip}`
    const entry = globalStore.increment(key, windowMs)

    c.header('X-RateLimit-Limit', String(maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > maxRequests) {
      return c.json({ error: 'Too many authentication attempts, please try again later' }, 429)
    }

    await next()
  }
}
