/**
 * @fileoverview Database connection with optimized pooling
 * Level 1 Foundation - Performance Optimization
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { logger } from '../lib/logger'

const log = logger.child({ component: 'database' })

// =============================================================================
// Configuration (inline to avoid circular deps)
// =============================================================================

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const isProduction = process.env.NODE_ENV === 'production'
const maxConnections = isProduction ? 10 : 5

// =============================================================================
// Connection Pool
// =============================================================================

const client = postgres(DATABASE_URL, {
  // Connection pool size
  max: maxConnections,
  
  // Idle connection timeout (seconds)
  idle_timeout: 20,
  
  // Connection acquisition timeout (seconds)
  connect_timeout: 10,
  
  // Prepare statements for better performance
  prepare: isProduction,
  
  // Connection lifecycle hooks
  onnotice: (notice) => {
    log.debug('PostgreSQL notice', { message: notice['message'] })
  },
  
  // Transform options for better type handling
  transform: {
    undefined: null,
  },
  
  // Debug logging in development
  debug: !isProduction ? (_connection: number, query: string, parameters: unknown[]) => {
    log.debug('SQL query', { 
      query: query.substring(0, 200),
      params: parameters?.length || 0,
    })
  } : false,
})

// =============================================================================
// Drizzle Instance
// =============================================================================

export const db = drizzle(client)

export type Database = PostgresJsDatabase

// =============================================================================
// Connection Management
// =============================================================================

/**
 * Test database connectivity
 */
export async function testConnection(): Promise<void> {
  const start = performance.now()
  
  try {
    await client`SELECT 1 AS health_check`
    const duration = Math.round(performance.now() - start)
    log.info('Database connection verified', { durationMs: duration })
  } catch (error) {
    log.error('Database connection failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Get connection pool statistics
 */
export function getPoolStats(): {
  totalConnections: number
  idleConnections: number
  waitingRequests: number
} {
  return {
    totalConnections: maxConnections,
    idleConnections: 0,
    waitingRequests: 0,
  }
}

/**
 * Execute a raw SQL query with timing
 */
export async function executeRaw<T>(
  query: string,
  params?: unknown[]
): Promise<{ rows: T[]; duration: number }> {
  const start = performance.now()
  
  const result = params 
    ? await client.unsafe(query, params as (string | number | boolean | null)[])
    : await client.unsafe(query)
  
  const duration = Math.round(performance.now() - start)
  
  return {
    rows: result as unknown as T[],
    duration,
  }
}

/**
 * Health check with detailed status
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  latencyMs: number
  version?: string
  connections?: number
}> {
  const start = performance.now()
  
  try {
    const result = await client`
      SELECT 
        version() as version,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as connections
    `
    
    const latencyMs = Math.round(performance.now() - start)
    const row = result[0] as { version: string; connections: string }
    const version = row.version.split(' ')[1]
    
    return {
      status: latencyMs < 100 ? 'healthy' : latencyMs < 500 ? 'degraded' : 'unhealthy',
      latencyMs,
      ...(version ? { version } : {}),
      connections: parseInt(row.connections, 10),
    }
  } catch {
    return {
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - start),
    }
  }
}

// Export raw client for advanced use cases
export { client }
