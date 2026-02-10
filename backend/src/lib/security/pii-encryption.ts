/**
 * Field-Level PII Encryption
 * 
 * Implements:
 * - AES-256-GCM encryption for PII fields
 * - Key rotation support
 * - Searchable encryption (deterministic mode for indexing)
 * - Automatic PII field detection
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'
import { logger } from '../logger'

const log = logger.child({ module: 'pii-encryption' })

// Configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32,          // 256 bits
  ivLength: 16,           // 128 bits for GCM
  tagLength: 16,          // Auth tag length
  saltLength: 32,
}

// PII field definitions - what to encrypt
const PII_FIELDS = new Set([
  'email',
  'phone',
  'dni',
  'nie',
  'passport',
  'address',
  'fullName',
  'full_name',
  'bankAccount',
  'bank_account',
  'iban',
  'taxId',
  'tax_id',
  'socialSecurity',
  'social_security',
  'dateOfBirth',
  'date_of_birth',
  'nationalId',
  'national_id',
])

// Derived key cache (expensive to compute)
const keyCache = new Map<string, Buffer>()

/**
 * Get or derive encryption key from master key
 */
function getEncryptionKey(purpose: string = 'default'): Buffer {
  const masterKey = process.env['ENCRYPTION_MASTER_KEY']
  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required')
  }

  const cacheKey = `${masterKey}:${purpose}`
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!
  }

  // Derive a key using scrypt
  const salt = createHash('sha256').update(`inmobiliaria:${purpose}`).digest()
  const derivedKey = scryptSync(masterKey, salt, ENCRYPTION_CONFIG.keyLength)
  
  keyCache.set(cacheKey, derivedKey)
  return derivedKey
}

/**
 * Encrypt a single value
 */
export function encryptValue(plaintext: string, fieldName?: string): string {
  if (!plaintext) return plaintext
  
  try {
    const key = getEncryptionKey(fieldName || 'default')
    const iv = randomBytes(ENCRYPTION_CONFIG.ivLength)
    
    const cipher = createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // Format: version:iv:authTag:ciphertext
    const result = `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
    
    return result
  } catch (error) {
    log.error('Encryption failed', { error, fieldName })
    throw new Error('Encryption failed')
  }
}

/**
 * Decrypt a single value
 */
export function decryptValue(ciphertext: string, fieldName?: string): string {
  if (!ciphertext) return ciphertext
  
  // Check if it's encrypted (has our format)
  if (!ciphertext.startsWith('v1:')) {
    return ciphertext // Return as-is if not encrypted
  }
  
  try {
    const parts = ciphertext.split(':')
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted format')
    }
    
    const [, ivHex, authTagHex, encrypted] = parts
    
    const key = getEncryptionKey(fieldName || 'default')
    const iv = Buffer.from(ivHex!, 'hex')
    const authTag = Buffer.from(authTagHex!, 'hex')
    
    const decipher = createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted!, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    log.error('Decryption failed', { error, fieldName })
    throw new Error('Decryption failed')
  }
}

/**
 * Create a searchable hash (deterministic, for exact-match lookups)
 * Note: This trades some security for searchability
 */
export function createSearchableHash(value: string, fieldName: string): string {
  if (!value) return value
  
  const key = getEncryptionKey(`search:${fieldName}`)
  const hash = createHash('sha256')
    .update(key)
    .update(value.toLowerCase().trim())
    .digest('hex')
  
  return `sh:${hash.substring(0, 32)}` // Prefix to identify searchable hashes
}

/**
 * Check if a field should be encrypted
 */
export function isPIIField(fieldName: string): boolean {
  return PII_FIELDS.has(fieldName) || PII_FIELDS.has(fieldName.toLowerCase())
}

/**
 * Encrypt all PII fields in an object
 */
export function encryptPII<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }
  
  for (const [key, value] of Object.entries(result)) {
    if (isPIIField(key) && typeof value === 'string' && value) {
      (result as Record<string, unknown>)[key] = encryptValue(value, key)
    }
  }
  
  return result
}

/**
 * Decrypt all PII fields in an object
 */
export function decryptPII<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj }
  
  for (const [key, value] of Object.entries(result)) {
    if (isPIIField(key) && typeof value === 'string' && value.startsWith('v1:')) {
      try {
        (result as Record<string, unknown>)[key] = decryptValue(value, key)
      } catch {
        // Log but don't fail - might be legacy unencrypted data
        log.warn('Failed to decrypt PII field', { field: key })
      }
    }
  }
  
  return result
}

/**
 * Encrypt specific fields in an object
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T, 
  fields: string[]
): T {
  const result = { ...obj }
  
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string' && value) {
      (result as Record<string, unknown>)[field] = encryptValue(value, field)
    }
  }
  
  return result
}

/**
 * Decrypt specific fields in an object
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T, 
  fields: string[]
): T {
  const result = { ...obj }
  
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string' && value.startsWith('v1:')) {
      (result as Record<string, unknown>)[field] = decryptValue(value, field)
    }
  }
  
  return result
}

/**
 * Key rotation helper - re-encrypt with new key
 */
export function rotateEncryption(
  ciphertext: string, 
  fieldName: string,
  oldKey: string,
  newKey: string
): string {
  // Temporarily override the key
  const originalKey = process.env.ENCRYPTION_MASTER_KEY
  
  try {
    // Decrypt with old key
    process.env.ENCRYPTION_MASTER_KEY = oldKey
    keyCache.clear()
    const plaintext = decryptValue(ciphertext, fieldName)
    
    // Encrypt with new key
    process.env.ENCRYPTION_MASTER_KEY = newKey
    keyCache.clear()
    return encryptValue(plaintext, fieldName)
  } finally {
    // Restore original key
    process.env.ENCRYPTION_MASTER_KEY = originalKey
    keyCache.clear()
  }
}

/**
 * Validate encryption key strength
 */
export function validateKeyStrength(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  const key = process.env.ENCRYPTION_MASTER_KEY || ''
  
  if (key.length < 32) {
    warnings.push('ENCRYPTION_MASTER_KEY should be at least 32 characters')
  }
  if (key.length < 64) {
    warnings.push('For maximum security, ENCRYPTION_MASTER_KEY should be 64+ characters')
  }
  if (key === 'your-encryption-key-here' || key === 'change-me') {
    warnings.push('ENCRYPTION_MASTER_KEY appears to be a default/placeholder value')
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  }
}

export { PII_FIELDS, ENCRYPTION_CONFIG }
