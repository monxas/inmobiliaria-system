/**
 * Test Helpers — Shared utilities for testing Hono apps
 */

import { Hono } from 'hono'
import { signJWT } from '../src/utils/crypto'
import { buildJwtPayload } from './factories'
import type { UserRole } from '../src/types'

/**
 * Make a request to a Hono app for testing
 */
export async function appRequest(
  app: Hono,
  method: string,
  path: string,
  options: {
    body?: unknown
    headers?: Record<string, string>
    token?: string
  } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const init: RequestInit = { method, headers }
  if (options.body) {
    init.body = JSON.stringify(options.body)
  }

  const req = new Request(`http://localhost${path}`, init)
  return app.fetch(req)
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(overrides: {
  userId?: number
  email?: string
  role?: UserRole
  full_name?: string
} = {}): string {
  return signJWT(buildJwtPayload(overrides))
}

/**
 * Parse JSON response helper
 */
export async function parseResponse<T = any>(res: Response): Promise<T> {
  return res.json() as Promise<T>
}

/**
 * Measure execution time of an async function
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await fn()
  const durationMs = performance.now() - start
  return { result, durationMs }
}
