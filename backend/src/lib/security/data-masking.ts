/**
 * Data Masking for Logs and Responses
 * 
 * Implements:
 * - Automatic PII detection and masking
 * - Configurable masking patterns
 * - Context-aware masking (full vs partial)
 * - Deep object traversal
 */

import { logger } from '../logger'

const log = logger.child({ module: 'data-masking' })

// Fields to fully mask (show only asterisks)
const FULL_MASK_FIELDS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'secret',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'bearer',
  'authorization',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
])

// Fields to partially mask (show first/last few chars)
const PARTIAL_MASK_FIELDS = new Set([
  'email',
  'phone',
  'telephone',
  'mobile',
  'dni',
  'nie',
  'nif',
  'passport',
  'iban',
  'bankAccount',
  'bank_account',
  'accountNumber',
  'account_number',
  'taxId',
  'tax_id',
])

// Patterns to detect and mask in string values
const SENSITIVE_PATTERNS = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    mask: (match: string) => maskEmail(match),
  },
  {
    name: 'phone',
    pattern: /(\+?[0-9]{1,3}[-.\s]?)?(\(?[0-9]{2,4}\)?[-.\s]?)?[0-9]{3,4}[-.\s]?[0-9]{3,4}/g,
    mask: (match: string) => maskPartial(match, 3, 2),
  },
  {
    name: 'iban',
    pattern: /[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}/g,
    mask: (match: string) => maskPartial(match, 4, 4),
  },
  {
    name: 'creditCard',
    pattern: /[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}/g,
    mask: (match: string) => maskPartial(match, 4, 4),
  },
  {
    name: 'dni',
    pattern: /[0-9]{8}[A-Z]/g,
    mask: (match: string) => maskPartial(match, 2, 1),
  },
  {
    name: 'jwt',
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    mask: () => '[JWT_TOKEN]',
  },
]

/**
 * Fully mask a value
 */
function maskFull(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(value.length)
  }
  return '*'.repeat(8) // Fixed length for very long secrets
}

/**
 * Partially mask a value, showing first and last N characters
 */
function maskPartial(value: string, showFirst: number, showLast: number): string {
  if (value.length <= showFirst + showLast) {
    return '*'.repeat(value.length)
  }
  
  const first = value.substring(0, showFirst)
  const last = value.substring(value.length - showLast)
  const middle = '*'.repeat(Math.min(value.length - showFirst - showLast, 8))
  
  return `${first}${middle}${last}`
}

/**
 * Mask an email address
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return maskFull(email)
  
  const maskedLocal = local.length > 2 
    ? `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}`
    : '*'.repeat(local.length)
  
  const domainParts = domain.split('.')
  const maskedDomain = domainParts.length > 1
    ? `${'*'.repeat(Math.min(domainParts[0]!.length, 5))}.${domainParts.slice(1).join('.')}`
    : '*'.repeat(domain.length)
  
  return `${maskedLocal}@${maskedDomain}`
}

/**
 * Check if a field name indicates sensitive data
 */
function isSensitiveField(fieldName: string): 'full' | 'partial' | null {
  const lowerName = fieldName.toLowerCase()
  
  if (FULL_MASK_FIELDS.has(fieldName) || FULL_MASK_FIELDS.has(lowerName)) {
    return 'full'
  }
  if (PARTIAL_MASK_FIELDS.has(fieldName) || PARTIAL_MASK_FIELDS.has(lowerName)) {
    return 'partial'
  }
  
  // Check for common patterns in field names
  if (lowerName.includes('password') || lowerName.includes('secret') || 
      lowerName.includes('token') || lowerName.includes('key')) {
    return 'full'
  }
  
  return null
}

/**
 * Mask sensitive patterns in a string
 */
function maskStringPatterns(value: string): string {
  let result = value
  
  for (const { pattern, mask } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, mask)
  }
  
  return result
}

/**
 * Deep mask sensitive data in an object
 */
export function maskSensitiveData<T>(data: T, options?: {
  maskPatterns?: boolean
  depth?: number
  currentDepth?: number
}): T {
  const maskPatterns = options?.maskPatterns ?? true
  const maxDepth = options?.depth ?? 10
  const currentDepth = options?.currentDepth ?? 0
  
  if (currentDepth > maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]' as T
  }
  
  if (data === null || data === undefined) {
    return data
  }
  
  if (typeof data === 'string') {
    return (maskPatterns ? maskStringPatterns(data) : data) as T
  }
  
  if (Array.isArray(data)) {
    return data.map(item => 
      maskSensitiveData(item, { ...options, currentDepth: currentDepth + 1 })
    ) as T
  }
  
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(data)) {
      const sensitivity = isSensitiveField(key)
      
      if (sensitivity === 'full' && typeof value === 'string') {
        result[key] = maskFull(value)
      } else if (sensitivity === 'partial' && typeof value === 'string') {
        result[key] = maskPartial(value, 3, 3)
      } else if (typeof value === 'object' && value !== null) {
        result[key] = maskSensitiveData(value, { ...options, currentDepth: currentDepth + 1 })
      } else if (typeof value === 'string' && maskPatterns) {
        result[key] = maskStringPatterns(value)
      } else {
        result[key] = value
      }
    }
    
    return result as T
  }
  
  return data
}

/**
 * Create a masked logger that automatically masks sensitive data
 */
export function createMaskedLogger(baseLogger: typeof log) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => 
      baseLogger.debug(msg, data ? maskSensitiveData(data) : undefined),
    info: (msg: string, data?: Record<string, unknown>) => 
      baseLogger.info(msg, data ? maskSensitiveData(data) : undefined),
    warn: (msg: string, data?: Record<string, unknown>) => 
      baseLogger.warn(msg, data ? maskSensitiveData(data) : undefined),
    error: (msg: string, data?: Record<string, unknown>) => 
      baseLogger.error(msg, data ? maskSensitiveData(data) : undefined),
  }
}

/**
 * Mask headers for logging (removes authorization, cookies, etc.)
 */
export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
    'proxy-authorization',
  ])
  
  const result: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.has(key.toLowerCase())) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = value
    }
  }
  
  return result
}

/**
 * Mask a URL (hide query parameters that might contain sensitive data)
 */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url, 'http://localhost')
    const sensitiveParams = new Set([
      'token', 'key', 'password', 'secret', 'api_key', 'apikey',
      'auth', 'session', 'sid', 'access_token', 'refresh_token',
    ])
    
    for (const [key] of parsed.searchParams) {
      if (sensitiveParams.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]')
      }
    }
    
    // Return just path and query if it was a relative URL
    return url.startsWith('http') 
      ? parsed.toString() 
      : `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

export {
  maskFull,
  maskPartial,
  maskEmail,
  FULL_MASK_FIELDS,
  PARTIAL_MASK_FIELDS,
  SENSITIVE_PATTERNS,
}
