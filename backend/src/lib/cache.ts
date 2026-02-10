/**
 * @fileoverview Cache abstraction layer
 * Level 1 Foundation - Performance Foundation
 * 
 * Provides unified cache interface with:
 * - KeyDB/Redis support (production)
 * - In-memory fallback (development/testing)
 * - TTL support and cache invalidation
 */

import { logger } from './logger'

const log = logger.child({ component: 'cache' })

// =============================================================================
// Cache Interface
// =============================================================================

export interface CacheClient {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  delPattern(pattern: string): Promise<void>
  exists(key: string): Promise<boolean>
  ttl(key: string): Promise<number>
  flush(): Promise<void>
  ping(): Promise<boolean>
  close(): Promise<void>
}

// =============================================================================
// In-Memory Cache (Fallback)
// =============================================================================

interface CacheEntry {
  value: unknown
  expiresAt: number | null
}

class MemoryCache implements CacheClient {
  private store = new Map<string, CacheEntry>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  
  constructor() {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    
    return entry.value as T
  }
  
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    this.store.set(key, { value, expiresAt })
  }
  
  async del(key: string): Promise<void> {
    this.store.delete(key)
  }
  
  async delPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key)
      }
    }
  }
  
  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key)
    if (!entry) return false
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return false
    }
    
    return true
  }
  
  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry || !entry.expiresAt) return -1
    
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  }
  
  async flush(): Promise<void> {
    this.store.clear()
  }
  
  async ping(): Promise<boolean> {
    return true
  }
  
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
  
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }
}

// =============================================================================
// Redis/KeyDB Cache
// =============================================================================

class RedisCache implements CacheClient {
  private client: import('ioredis').Redis | null = null
  private url: string
  
  constructor(url: string) {
    this.url = url
  }
  
  private async getClient(): Promise<import('ioredis').Redis> {
    if (!this.client) {
      const { default: Redis } = await import('ioredis')
      this.client = new Redis(this.url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      })
      await this.client.connect()
    }
    return this.client
  }
  
  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient()
    const value = await client.get(key)
    if (!value) return null
    
    try {
      return JSON.parse(value) as T
    } catch {
      return value as T
    }
  }
  
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient()
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized)
    } else {
      await client.set(key, serialized)
    }
  }
  
  async del(key: string): Promise<void> {
    const client = await this.getClient()
    await client.del(key)
  }
  
  async delPattern(pattern: string): Promise<void> {
    const client = await this.getClient()
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(...keys)
    }
  }
  
  async exists(key: string): Promise<boolean> {
    const client = await this.getClient()
    const result = await client.exists(key)
    return result === 1
  }
  
  async ttl(key: string): Promise<number> {
    const client = await this.getClient()
    return client.ttl(key)
  }
  
  async flush(): Promise<void> {
    const client = await this.getClient()
    await client.flushdb()
  }
  
  async ping(): Promise<boolean> {
    try {
      const client = await this.getClient()
      const result = await client.ping()
      return result === 'PONG'
    } catch {
      return false
    }
  }
  
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
  }
}

// =============================================================================
// Cache Singleton
// =============================================================================

let _cache: CacheClient | null = null

export function getCache(): CacheClient {
  if (_cache) return _cache
  
  const redisUrl = process.env.REDIS_URL
  
  if (redisUrl) {
    log.info('Using Redis/KeyDB cache', { url: redisUrl.replace(/\/\/.*@/, '//***@') })
    _cache = new RedisCache(redisUrl)
  } else {
    log.info('Using in-memory cache (no REDIS_URL configured)')
    _cache = new MemoryCache()
  }
  
  return _cache
}

// =============================================================================
// Cache Keys Factory
// =============================================================================

export const CacheKeys = {
  // User cache
  user: (id: number) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  userList: (page: number, limit: number) => `users:list:${page}:${limit}`,
  
  // Property cache
  property: (id: number) => `property:${id}`,
  propertyList: (page: number, limit: number, filters: string) => 
    `properties:list:${page}:${limit}:${filters}`,
  
  // Client cache
  client: (id: number) => `client:${id}`,
  clientList: (page: number, limit: number) => `clients:list:${page}:${limit}`,
  
  // Session/Auth
  session: (userId: number) => `session:${userId}`,
  refreshToken: (hash: string) => `refresh:${hash}`,
  
  // Invalidation patterns
  userPattern: (id: number) => `user:${id}*`,
  propertyPattern: (id: number) => `property:${id}*`,
  clientPattern: (id: number) => `client:${id}*`,
  allProperties: () => 'properties:*',
  allUsers: () => 'users:*',
  allClients: () => 'clients:*',
}

// =============================================================================
// Cache TTLs (seconds)
// =============================================================================

export const CacheTTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 3600,       // 1 hour
  DAY: 86400,       // 24 hours
  
  // Specific TTLs
  USER: 300,
  PROPERTY: 180,
  LIST: 60,
  SESSION: 900,     // 15 minutes
}
