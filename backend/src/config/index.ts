/**
 * @fileoverview Centralized configuration with validation
 * Level 1 Foundation - Configuration Management
 * 
 * All environment variables are validated at startup.
 * Application fails fast if required config is missing.
 */

import { z } from 'zod'

// =============================================================================
// Configuration Schema - Type-safe environment validation
// =============================================================================

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  
  // Cache (optional, defaults to memory cache if not provided)
  REDIS_URL: z.string().url().optional(),
  
  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  
  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  
  // File Storage
  UPLOAD_DIR: z.string().default('/app/uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().min(1).max(100).default(10),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(60000),
  RATE_LIMIT_MAX: z.coerce.number().min(1).default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().min(1).default(10),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  
  // App Info
  APP_VERSION: z.string().default('1.0.0'),
  
  // Security Headers
  ENABLE_HSTS: z.coerce.boolean().default(true),
})

export type EnvConfig = z.infer<typeof envSchema>

// =============================================================================
// Configuration Singleton
// =============================================================================

let _config: EnvConfig | null = null

/**
 * Load and validate configuration from environment variables.
 * Throws on validation failure (fail-fast).
 */
export function loadConfig(): EnvConfig {
  if (_config) return _config
  
  const result = envSchema.safeParse(process.env)
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => 
      `  - ${issue.path.join('.')}: ${issue.message}`
    ).join('\n')
    
    console.error(`\n❌ Configuration validation failed:\n${errors}\n`)
    process.exit(1)
  }
  
  _config = result.data
  return _config
}

/**
 * Get configuration (throws if not loaded).
 */
export function getConfig(): EnvConfig {
  if (!_config) {
    return loadConfig()
  }
  return _config
}

// =============================================================================
// Derived Configuration Helpers
// =============================================================================

export function getCorsOrigins(): string[] {
  return getConfig().CORS_ORIGINS.split(',').map(o => o.trim())
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development'
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production'
}

export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test'
}

// =============================================================================
// Database Configuration
// =============================================================================

export interface DatabaseConfig {
  url: string
  maxConnections: number
  idleTimeout: number
  connectTimeout: number
}

export function getDatabaseConfig(): DatabaseConfig {
  const env = getConfig()
  return {
    url: env.DATABASE_URL,
    maxConnections: isProduction() ? 10 : 5,
    idleTimeout: 20,
    connectTimeout: 10,
  }
}

// =============================================================================
// Cache Configuration
// =============================================================================

export interface CacheConfig {
  url: string | undefined
  enabled: boolean
  defaultTTL: number
}

export function getCacheConfig(): CacheConfig {
  const env = getConfig()
  return {
    url: env.REDIS_URL,
    enabled: !!env.REDIS_URL,
    defaultTTL: 300, // 5 minutes
  }
}

// =============================================================================
// Rate Limit Configuration
// =============================================================================

export interface RateLimitConfig {
  windowMs: number
  max: number
  authMax: number
}

export function getRateLimitConfig(): RateLimitConfig {
  const env = getConfig()
  return {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    authMax: env.AUTH_RATE_LIMIT_MAX,
  }
}
