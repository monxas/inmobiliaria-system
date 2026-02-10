import type { Context, Next } from 'hono'
import { logger } from '../lib/logger'

const log = logger.child({ middleware: 'rate-limiter' })

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
  keyPrefix?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitEntry {
  count: number
  resetAt: number
  blockedAt?: number
}

/**
 * Endpoint type categories for granular rate limiting
 */
export enum EndpointType {
  AUTH = 'auth',           // Login, register, password reset
  UPLOAD = 'upload',       // File uploads
  WRITE = 'write',         // POST, PUT, DELETE
  READ = 'read',           // GET requests
  SEARCH = 'search',       // Search/filter operations
  SENSITIVE = 'sensitive', // User data, settings
}

/**
 * Default rate limits by endpoint type
 */
const DEFAULT_LIMITS: Record<EndpointType, { windowMs: number; maxRequests: number }> = {
  [EndpointType.AUTH]: { windowMs: 60_000, maxRequests: 5 },        // 5 per minute
  [EndpointType.UPLOAD]: { windowMs: 60_000, maxRequests: 10 },     // 10 per minute
  [EndpointType.WRITE]: { windowMs: 60_000, maxRequests: 30 },      // 30 per minute
  [EndpointType.READ]: { windowMs: 60_000, maxRequests: 100 },      // 100 per minute
  [EndpointType.SEARCH]: { windowMs: 60_000, maxRequests: 30 },     // 30 per minute
  [EndpointType.SENSITIVE]: { windowMs: 60_000, maxRequests: 20 },  // 20 per minute
}

/**
 * Progressive blocking durations (in ms) for repeated violations
 */
const BLOCK_DURATIONS = [
  60_000,      // 1 minute
  300_000,     // 5 minutes
  900_000,     // 15 minutes
  3600_000,    // 1 hour
  86400_000,   // 24 hours
]

/**
 * In-memory rate limiter with progressive blocking.
 * For multi-instance deployments, replace with Redis-based store.
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private violations = new Map<string, number>() // Track violation count per IP
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
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

  /**
   * Record a rate limit violation and return block duration
   */
  recordViolation(ip: string): number {
    const count = (this.violations.get(ip) || 0) + 1
    this.violations.set(ip, count)
    const index = Math.min(count - 1, BLOCK_DURATIONS.length - 1)
    return BLOCK_DURATIONS[index] ?? BLOCK_DURATIONS[0] ?? 60_000
  }

  /**
   * Check if IP is currently blocked
   */
  isBlocked(ip: string): { blocked: boolean; retryAfter?: number } {
    const key = `block:${ip}`
    const entry = this.store.get(key)
    if (entry && Date.now() < entry.resetAt) {
      return { blocked: true, retryAfter: Math.ceil((entry.resetAt - Date.now()) / 1000) }
    }
    return { blocked: false }
  }

  /**
   * Block an IP for a duration
   */
  block(ip: string, durationMs: number): void {
    const key = `block:${ip}`
    this.store.set(key, {
      count: 0,
      resetAt: Date.now() + durationMs,
      blockedAt: Date.now(),
    })
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) this.store.delete(key)
    }
    // Cleanup old violations (reset after 24 hours of no violations)
    // In production, you'd want to persist this
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.store.clear()
    this.violations.clear()
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { entries: number; violations: number } {
    return {
      entries: this.store.size,
      violations: this.violations.size,
    }
  }
}

const globalStore = new RateLimitStore()

/**
 * Extract client IP with proxy awareness
 */
function getClientIP(c: Context): string {
  // Check multiple headers for proxy scenarios
  const xForwardedFor = c.req.header('x-forwarded-for')
  if (xForwardedFor) {
    // Take the first IP (original client) if multiple
    const firstIp = xForwardedFor.split(',')[0]
    return firstIp?.trim() ?? 'unknown'
  }
  
  const xRealIp = c.req.header('x-real-ip')
  if (xRealIp) return xRealIp.trim()
  
  const cfConnectingIp = c.req.header('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp.trim()
  
  return 'unknown'
}

/**
 * Generate a unique key for rate limiting
 */
function generateKey(ip: string, prefix: string, userId?: number): string {
  // If authenticated, also include userId to allow fair per-user limits
  if (userId) {
    return `${prefix}:user:${userId}:${ip}`
  }
  return `${prefix}:${ip}`
}

/**
 * Generic rate limiter factory
 */
export function rateLimiter(config?: Partial<RateLimitConfig>) {
  const windowMs = config?.windowMs ?? (Number(process.env['RATE_LIMIT_WINDOW_MS']) || 60_000)
  const maxRequests = config?.maxRequests ?? (Number(process.env['RATE_LIMIT_MAX']) || 100)
  const message = config?.message ?? 'Too many requests, please try again later'
  const keyPrefix = config?.keyPrefix ?? 'general'

  return async (c: Context, next: Next): Promise<Response | void> => {
    const ip = getClientIP(c)
    
    // Check if IP is blocked
    const blockStatus = globalStore.isBlocked(ip)
    if (blockStatus.blocked) {
      c.header('Retry-After', String(blockStatus.retryAfter ?? 60))
      log.warn('Blocked IP attempted request', { ip, retryAfter: blockStatus.retryAfter })
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    const key = generateKey(ip, keyPrefix)
    const entry = globalStore.increment(key, windowMs)

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > maxRequests) {
      // Record violation and potentially block
      const blockDuration = globalStore.recordViolation(ip)
      if (entry.count > maxRequests * 2) {
        // Aggressive violator - block them
        globalStore.block(ip, blockDuration)
        log.warn('IP blocked for rate limit violations', { ip, duration: blockDuration })
      }

      c.header('Retry-After', String(Math.ceil((entry.resetAt - Date.now()) / 1000)))
      return c.json({ error: message }, 429)
    }

    await next()
  }
}

/**
 * Stricter rate limiter for authentication endpoints
 */
export function authRateLimiter() {
  const limits = DEFAULT_LIMITS[EndpointType.AUTH]
  
  return async (c: Context, next: Next): Promise<Response | void> => {
    const ip = getClientIP(c)
    
    // Check block status
    const blockStatus = globalStore.isBlocked(ip)
    if (blockStatus.blocked) {
      c.header('Retry-After', String(blockStatus.retryAfter ?? 60))
      return c.json({ error: 'Too many authentication attempts. Please try again later.' }, 429)
    }

    const key = `auth:${ip}`
    const entry = globalStore.increment(key, limits.windowMs)

    c.header('X-RateLimit-Limit', String(limits.maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, limits.maxRequests - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > limits.maxRequests) {
      const blockDuration = globalStore.recordViolation(ip)
      globalStore.block(ip, blockDuration)
      
      log.warn('Auth rate limit exceeded', { 
        ip, 
        attempts: entry.count, 
        blockDuration: blockDuration / 1000 
      })
      
      c.header('Retry-After', String(Math.ceil(blockDuration / 1000)))
      return c.json({ error: 'Too many authentication attempts. Please try again later.' }, 429)
    }

    await next()
  }
}

/**
 * Rate limiter for file uploads
 */
export function uploadRateLimiter() {
  const limits = DEFAULT_LIMITS[EndpointType.UPLOAD]
  
  return rateLimiter({
    ...limits,
    keyPrefix: 'upload',
    message: 'Upload limit exceeded. Please wait before uploading more files.',
  })
}

/**
 * Rate limiter for write operations (POST, PUT, DELETE)
 */
export function writeRateLimiter() {
  const limits = DEFAULT_LIMITS[EndpointType.WRITE]
  
  return rateLimiter({
    ...limits,
    keyPrefix: 'write',
    message: 'Too many write requests. Please slow down.',
  })
}

/**
 * Rate limiter for search/filter operations
 */
export function searchRateLimiter() {
  const limits = DEFAULT_LIMITS[EndpointType.SEARCH]
  
  return rateLimiter({
    ...limits,
    keyPrefix: 'search',
    message: 'Search rate limit exceeded. Please wait before searching again.',
  })
}

/**
 * Rate limiter for sensitive endpoints (user data, settings)
 */
export function sensitiveRateLimiter() {
  const limits = DEFAULT_LIMITS[EndpointType.SENSITIVE]
  
  return rateLimiter({
    ...limits,
    keyPrefix: 'sensitive',
    message: 'Rate limit exceeded for sensitive operations.',
  })
}

/**
 * Get rate limiter stats for monitoring
 */
export function getRateLimiterStats() {
  return globalStore.getStats()
}
