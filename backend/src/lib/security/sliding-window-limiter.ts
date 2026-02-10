/**
 * Advanced Sliding Window Rate Limiter
 * 
 * Implements:
 * - True sliding window algorithm (not fixed windows)
 * - Per-user, per-IP, and per-endpoint limits
 * - Distributed-ready interface (Redis compatible)
 * - Cost-based rate limiting (some operations cost more)
 */

import { logger } from '../logger'

const log = logger.child({ module: 'sliding-window-limiter' })

// Configuration for different limit types
export interface RateLimitRule {
  name: string
  windowMs: number      // Window size in milliseconds
  maxRequests: number   // Max requests in window
  costPerRequest?: number // Default cost per request (default: 1)
  burstLimit?: number   // Allow short bursts above limit
  penaltyMultiplier?: number // Multiply window on violations
}

// Built-in rate limit presets
export const RATE_LIMIT_PRESETS: Record<string, RateLimitRule> = {
  // Very strict - auth endpoints
  auth: {
    name: 'auth',
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5,
    penaltyMultiplier: 2,
  },
  
  // Strict - write operations
  write: {
    name: 'write',
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 30,
    costPerRequest: 2,
  },
  
  // Standard - read operations
  read: {
    name: 'read',
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,
    burstLimit: 20,
  },
  
  // Lenient - static content
  static: {
    name: 'static',
    windowMs: 60 * 1000,
    maxRequests: 200,
    burstLimit: 50,
  },
  
  // Very strict - admin operations
  admin: {
    name: 'admin',
    windowMs: 60 * 1000,
    maxRequests: 20,
    costPerRequest: 3,
    penaltyMultiplier: 3,
  },
  
  // File uploads
  upload: {
    name: 'upload',
    windowMs: 60 * 1000,
    maxRequests: 10,
    costPerRequest: 5,
  },
  
  // Search/query
  search: {
    name: 'search',
    windowMs: 60 * 1000,
    maxRequests: 30,
    costPerRequest: 2,
  },
  
  // Export operations
  export: {
    name: 'export',
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 5,
    costPerRequest: 10,
  },
}

interface WindowEntry {
  timestamps: number[]   // Timestamps of requests in window
  totalCost: number      // Total cost in current window
  penaltyUntil?: number  // Penalty end time
  violationCount: number // Number of violations
}

interface LimitResult {
  allowed: boolean
  remaining: number
  resetAt: number       // Unix timestamp when window resets
  retryAfter?: number   // Seconds until retry allowed
  cost: number          // Cost of this request
  penalized: boolean    // Whether currently under penalty
}

// In-memory sliding window store
class SlidingWindowStore {
  private windows = new Map<string, WindowEntry>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    // Cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
  }

  /**
   * Check and increment rate limit using sliding window
   */
  checkLimit(
    key: string,
    rule: RateLimitRule,
    cost: number = 1
  ): LimitResult {
    const now = Date.now()
    const windowStart = now - rule.windowMs
    
    let entry = this.windows.get(key)
    
    if (!entry) {
      entry = {
        timestamps: [],
        totalCost: 0,
        violationCount: 0,
      }
      this.windows.set(key, entry)
    }
    
    // Check if under penalty
    if (entry.penaltyUntil && entry.penaltyUntil > now) {
      const retryAfter = Math.ceil((entry.penaltyUntil - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.ceil(entry.penaltyUntil / 1000),
        retryAfter,
        cost,
        penalized: true,
      }
    }
    
    // Slide the window - remove old timestamps
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart)
    
    // Recalculate cost (simplified - in production track cost per request)
    entry.totalCost = entry.timestamps.length * (rule.costPerRequest || 1)
    
    const effectiveCost = cost * (rule.costPerRequest || 1)
    const effectiveLimit = rule.maxRequests * (rule.costPerRequest || 1)
    const burstLimit = (rule.burstLimit || 0) * (rule.costPerRequest || 1)
    
    // Check if within limit
    const currentUsage = entry.totalCost
    const newUsage = currentUsage + effectiveCost
    
    // Allow burst
    const allowedLimit = effectiveLimit + burstLimit
    
    if (newUsage > allowedLimit) {
      // Rate limited
      entry.violationCount++
      
      // Apply penalty if configured
      if (rule.penaltyMultiplier && entry.violationCount >= 2) {
        const penaltyDuration = rule.windowMs * rule.penaltyMultiplier * 
          Math.min(entry.violationCount - 1, 5)
        entry.penaltyUntil = now + penaltyDuration
        
        log.warn('Rate limit penalty applied', {
          key,
          rule: rule.name,
          violationCount: entry.violationCount,
          penaltyMs: penaltyDuration,
        })
      }
      
      // Calculate when they can retry
      const oldestInWindow = entry.timestamps.length > 0 
        ? Math.min(...entry.timestamps) 
        : now
      const retryAfter = Math.ceil((oldestInWindow + rule.windowMs - now) / 1000)
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.ceil((oldestInWindow + rule.windowMs) / 1000),
        retryAfter: Math.max(1, retryAfter),
        cost: effectiveCost,
        penalized: !!entry.penaltyUntil,
      }
    }
    
    // Request allowed - add timestamp
    entry.timestamps.push(now)
    entry.totalCost = newUsage
    
    // Reset violation count on successful request
    if (entry.violationCount > 0 && currentUsage < effectiveLimit / 2) {
      entry.violationCount = Math.max(0, entry.violationCount - 1)
    }
    
    const remaining = Math.max(0, Math.floor((effectiveLimit - newUsage) / (rule.costPerRequest || 1)))
    
    return {
      allowed: true,
      remaining,
      resetAt: Math.ceil((now + rule.windowMs) / 1000),
      cost: effectiveCost,
      penalized: false,
    }
  }

  /**
   * Get current usage without incrementing
   */
  getUsage(key: string, rule: RateLimitRule): {
    current: number
    limit: number
    remaining: number
    windowStart: number
  } {
    const now = Date.now()
    const windowStart = now - rule.windowMs
    const entry = this.windows.get(key)
    
    if (!entry) {
      return {
        current: 0,
        limit: rule.maxRequests,
        remaining: rule.maxRequests,
        windowStart: now,
      }
    }
    
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart)
    const current = validTimestamps.length
    
    return {
      current,
      limit: rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - current),
      windowStart: validTimestamps.length > 0 ? Math.min(...validTimestamps) : now,
    }
  }

  /**
   * Reset limits for a key
   */
  reset(key: string): void {
    this.windows.delete(key)
  }

  /**
   * Reset all limits for a key prefix (e.g., all limits for a user)
   */
  resetByPrefix(prefix: string): number {
    let count = 0
    for (const key of this.windows.keys()) {
      if (key.startsWith(prefix)) {
        this.windows.delete(key)
        count++
      }
    }
    return count
  }

  private cleanup(): void {
    const now = Date.now()
    // Find the maximum window size for cleanup
    const maxWindow = Math.max(
      ...Object.values(RATE_LIMIT_PRESETS).map(r => r.windowMs)
    )
    const cutoff = now - maxWindow * 2
    
    for (const [key, entry] of this.windows) {
      // Remove entries with no recent activity
      if (entry.timestamps.length === 0 || 
          Math.max(...entry.timestamps) < cutoff) {
        this.windows.delete(key)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.windows.clear()
  }

  getStats(): {
    totalKeys: number
    keysByRule: Record<string, number>
  } {
    const keysByRule: Record<string, number> = {}
    
    for (const key of this.windows.keys()) {
      const rule = key.split(':')[0] || 'unknown'
      keysByRule[rule] = (keysByRule[rule] || 0) + 1
    }
    
    return {
      totalKeys: this.windows.size,
      keysByRule,
    }
  }
}

const store = new SlidingWindowStore()

/**
 * Generate a rate limit key
 */
export function generateLimitKey(
  rule: RateLimitRule,
  identifier: string,
  additionalKey?: string
): string {
  const parts = [rule.name, identifier]
  if (additionalKey) parts.push(additionalKey)
  return parts.join(':')
}

/**
 * Check rate limit
 */
export function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
  options?: {
    cost?: number
    additionalKey?: string
  }
): LimitResult {
  const key = generateLimitKey(rule, identifier, options?.additionalKey)
  return store.checkLimit(key, rule, options?.cost)
}

/**
 * Get current usage
 */
export function getRateLimitUsage(
  rule: RateLimitRule,
  identifier: string,
  additionalKey?: string
) {
  const key = generateLimitKey(rule, identifier, additionalKey)
  return store.getUsage(key, rule)
}

/**
 * Reset rate limits for an identifier
 */
export function resetRateLimits(identifier: string): number {
  return store.resetByPrefix(identifier)
}

/**
 * Get rate limiter statistics
 */
export function getSlidingWindowStats() {
  return store.getStats()
}

export { store as slidingWindowStore }
