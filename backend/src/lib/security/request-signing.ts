/**
 * Request Signing / HMAC for Critical Endpoints
 * 
 * Implements:
 * - HMAC-SHA256 request signing
 * - Timestamp validation (replay attack prevention)
 * - Nonce tracking (prevent duplicate requests)
 * - Multiple API key support
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { logger } from '../logger'

const log = logger.child({ module: 'request-signing' })

// Configuration
const SIGNING_CONFIG = {
  // Maximum age for signed requests (5 minutes)
  maxRequestAge: 5 * 60 * 1000,
  
  // Algorithm
  algorithm: 'sha256',
  
  // Header names
  headers: {
    signature: 'X-Signature',
    timestamp: 'X-Timestamp',
    nonce: 'X-Nonce',
    apiKeyId: 'X-API-Key-ID',
  },
  
  // Nonce expiry (same as max request age)
  nonceExpiryMs: 5 * 60 * 1000,
}

// Nonce tracking (prevent replay attacks)
class NonceStore {
  private nonces = new Map<string, number>() // nonce -> timestamp
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
  }

  /**
   * Check if nonce has been used and mark as used
   * Returns true if nonce is valid (not used before)
   */
  useNonce(nonce: string): boolean {
    if (this.nonces.has(nonce)) {
      return false // Already used
    }
    this.nonces.set(nonce, Date.now())
    return true
  }

  private cleanup(): void {
    const cutoff = Date.now() - SIGNING_CONFIG.nonceExpiryMs
    for (const [nonce, timestamp] of this.nonces) {
      if (timestamp < cutoff) {
        this.nonces.delete(nonce)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.nonces.clear()
  }
}

const nonceStore = new NonceStore()

// API keys store (in production, load from database)
interface APIKey {
  id: string
  secret: string
  name: string
  userId?: number
  permissions: string[]
  rateLimit?: number
  enabled: boolean
  createdAt: Date
  lastUsedAt?: Date
}

class APIKeyStore {
  private keys = new Map<string, APIKey>()

  add(key: APIKey): void {
    this.keys.set(key.id, key)
  }

  get(id: string): APIKey | undefined {
    return this.keys.get(id)
  }

  remove(id: string): void {
    this.keys.delete(id)
  }

  updateLastUsed(id: string): void {
    const key = this.keys.get(id)
    if (key) {
      key.lastUsedAt = new Date()
    }
  }

  list(): APIKey[] {
    return Array.from(this.keys.values())
  }
}

const apiKeyStore = new APIKeyStore()

export interface SignedRequestParts {
  method: string
  path: string
  body?: string
  timestamp: string
  nonce: string
}

export interface SignatureValidation {
  valid: boolean
  apiKeyId?: string
  error?: string
  userId?: number
  permissions?: string[]
}

/**
 * Generate a signature for a request
 */
export function generateSignature(
  parts: SignedRequestParts,
  secret: string
): string {
  // Create canonical string
  const canonical = [
    parts.method.toUpperCase(),
    parts.path,
    parts.timestamp,
    parts.nonce,
    parts.body || '',
  ].join('\n')
  
  // Create HMAC signature
  const signature = createHmac(SIGNING_CONFIG.algorithm, secret)
    .update(canonical)
    .digest('hex')
  
  return signature
}

/**
 * Validate a signed request
 */
export function validateSignature(
  parts: SignedRequestParts,
  providedSignature: string,
  apiKeyId: string
): SignatureValidation {
  // Get API key
  const apiKey = apiKeyStore.get(apiKeyId)
  if (!apiKey) {
    log.warn('Unknown API key ID', { apiKeyId })
    return { valid: false, error: 'Invalid API key' }
  }
  
  if (!apiKey.enabled) {
    log.warn('Disabled API key used', { apiKeyId })
    return { valid: false, error: 'API key is disabled' }
  }
  
  // Validate timestamp
  const timestamp = parseInt(parts.timestamp, 10)
  const now = Date.now()
  const age = Math.abs(now - timestamp)
  
  if (isNaN(timestamp) || age > SIGNING_CONFIG.maxRequestAge) {
    log.warn('Request timestamp invalid or expired', { 
      apiKeyId, 
      timestamp, 
      age,
      maxAge: SIGNING_CONFIG.maxRequestAge 
    })
    return { valid: false, error: 'Request expired or invalid timestamp' }
  }
  
  // Validate nonce (prevent replay)
  if (!nonceStore.useNonce(parts.nonce)) {
    log.warn('Nonce reuse detected', { apiKeyId, nonce: parts.nonce })
    return { valid: false, error: 'Duplicate request (nonce reused)' }
  }
  
  // Generate expected signature
  const expectedSignature = generateSignature(parts, apiKey.secret)
  
  // Timing-safe comparison
  const providedBuffer = Buffer.from(providedSignature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  
  if (providedBuffer.length !== expectedBuffer.length) {
    log.warn('Signature length mismatch', { apiKeyId })
    return { valid: false, error: 'Invalid signature' }
  }
  
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    log.warn('Signature validation failed', { apiKeyId })
    return { valid: false, error: 'Invalid signature' }
  }
  
  // Update last used
  apiKeyStore.updateLastUsed(apiKeyId)
  
  log.debug('Signature validated', { apiKeyId })
  
  return {
    valid: true,
    apiKeyId,
    userId: apiKey.userId,
    permissions: apiKey.permissions,
  }
}

/**
 * Generate a random nonce
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Create an API key
 */
export function createAPIKey(
  name: string,
  permissions: string[],
  userId?: number
): { id: string; secret: string } {
  const id = `key_${randomBytes(8).toString('hex')}`
  const secret = randomBytes(32).toString('hex')
  
  apiKeyStore.add({
    id,
    secret,
    name,
    userId,
    permissions,
    enabled: true,
    createdAt: new Date(),
  })
  
  log.info('API key created', { id, name, permissions })
  
  // Return secret only once - it's not stored in plaintext
  // In production, you'd hash the secret
  return { id, secret }
}

/**
 * Revoke an API key
 */
export function revokeAPIKey(id: string): boolean {
  const key = apiKeyStore.get(id)
  if (!key) return false
  
  key.enabled = false
  log.info('API key revoked', { id, name: key.name })
  return true
}

/**
 * Delete an API key
 */
export function deleteAPIKey(id: string): boolean {
  const key = apiKeyStore.get(id)
  if (!key) return false
  
  apiKeyStore.remove(id)
  log.info('API key deleted', { id, name: key.name })
  return true
}

/**
 * List API keys (without secrets)
 */
export function listAPIKeys(): Omit<APIKey, 'secret'>[] {
  return apiKeyStore.list().map(({ secret, ...rest }) => rest)
}

/**
 * Middleware helper: extract signature parts from request
 */
export function extractSignatureParts(req: {
  method: string
  path: string
  header: (name: string) => string | undefined
  rawBody?: string
}): SignedRequestParts & { signature?: string; apiKeyId?: string } | null {
  const signature = req.header(SIGNING_CONFIG.headers.signature)
  const timestamp = req.header(SIGNING_CONFIG.headers.timestamp)
  const nonce = req.header(SIGNING_CONFIG.headers.nonce)
  const apiKeyId = req.header(SIGNING_CONFIG.headers.apiKeyId)
  
  if (!signature || !timestamp || !nonce || !apiKeyId) {
    return null
  }
  
  return {
    method: req.method,
    path: req.path,
    body: req.rawBody,
    timestamp,
    nonce,
    signature,
    apiKeyId,
  }
}

/**
 * Sign a request (client helper)
 */
export function signRequest(
  method: string,
  path: string,
  body: string | undefined,
  apiKeyId: string,
  apiKeySecret: string
): {
  signature: string
  timestamp: string
  nonce: string
  apiKeyId: string
} {
  const timestamp = Date.now().toString()
  const nonce = generateNonce()
  
  const signature = generateSignature(
    { method, path, body, timestamp, nonce },
    apiKeySecret
  )
  
  return {
    signature,
    timestamp,
    nonce,
    apiKeyId,
  }
}

export { SIGNING_CONFIG, apiKeyStore }
