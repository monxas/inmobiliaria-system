/**
 * Advanced JWT Security Module
 * 
 * Implements:
 * - Audience (aud) and Issuer (iss) validation
 * - JWT ID (jti) for token uniqueness/revocation
 * - Strict claims validation
 * - Token type enforcement
 */

import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { logger } from '../logger'

const log = logger.child({ module: 'jwt-advanced' })

// Configuration with secure defaults
const JWT_CONFIG = {
  issuer: process.env['JWT_ISSUER'] ?? 'inmobiliaria-system',
  audience: process.env['JWT_AUDIENCE'] ?? 'inmobiliaria-api',
  algorithm: 'HS256' as const,
  accessTokenExpiry: process.env['ACCESS_TOKEN_EXPIRY'] ?? '15m',
  refreshTokenExpiry: process.env['REFRESH_TOKEN_EXPIRY'] ?? '7d',
}

// Token types for strict validation
export type TokenType = 'access' | 'refresh' | 'api_key' | 'mfa_pending'

export interface JWTPayload {
  userId: number
  email: string
  role: string
  fullName: string
  type: TokenType
  // Standard JWT claims
  jti: string       // JWT ID - unique identifier
  iss: string       // Issuer
  aud: string       // Audience
  iat: number       // Issued at
  exp: number       // Expiry
  nbf: number       // Not before
  // Security context
  sessionId?: string
  deviceFingerprint?: string
  mfaVerified?: boolean
}

export interface SignOptions {
  type: TokenType
  expiresIn?: string
  sessionId?: string
  deviceFingerprint?: string
  mfaVerified?: boolean
  additionalClaims?: Record<string, unknown>
}

export interface VerifyOptions {
  type: TokenType
  requireMFA?: boolean
  allowedRoles?: string[]
}

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET']
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  // Validate secret strength
  if (secret.length < 32) {
    log.warn('JWT_SECRET is shorter than recommended 32 characters')
  }
  return secret
}

/**
 * Generate a unique JWT ID (jti)
 */
function generateJti(): string {
  return createHash('sha256')
    .update(randomBytes(32))
    .update(Date.now().toString())
    .digest('hex')
    .substring(0, 32)
}

/**
 * Sign a JWT with advanced security claims
 */
export function signAdvancedJWT(
  payload: {
    userId: number
    email: string
    role: string
    fullName: string
  },
  options: SignOptions
): string {
  const now = Math.floor(Date.now() / 1000)
  const jti = generateJti()
  
  const fullPayload: Record<string, unknown> = {
    // User claims
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    fullName: payload.fullName,
    
    // Token type
    type: options.type,
    
    // Standard claims
    jti,
    iss: JWT_CONFIG.issuer,
    aud: JWT_CONFIG.audience,
    iat: now,
    nbf: now, // Valid immediately
    
    // Optional security context
    ...(options.sessionId && { sessionId: options.sessionId }),
    ...(options.deviceFingerprint && { deviceFingerprint: options.deviceFingerprint }),
    ...(options.mfaVerified !== undefined && { mfaVerified: options.mfaVerified }),
    
    // Additional claims
    ...options.additionalClaims,
  }
  
  const expiresIn: string = options.expiresIn ?? 
    (options.type === 'access' ? JWT_CONFIG.accessTokenExpiry : JWT_CONFIG.refreshTokenExpiry)
  
  const token = jwt.sign(fullPayload, getJwtSecret(), {
    algorithm: JWT_CONFIG.algorithm,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  })
  
  log.debug('JWT signed', { 
    jti, 
    type: options.type, 
    userId: payload.userId,
    expiresIn 
  })
  
  return token
}

/**
 * Verify a JWT with strict validation
 */
export function verifyAdvancedJWT(
  token: string,
  options: VerifyOptions
): JWTPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_CONFIG.algorithm],
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
      complete: false,
    }) as JWTPayload
    
    // Validate token type
    if (decoded.type !== options.type) {
      log.warn('Token type mismatch', { 
        expected: options.type, 
        got: decoded.type,
        jti: decoded.jti 
      })
      throw new Error('Invalid token type')
    }
    
    // Validate MFA if required
    if (options.requireMFA && !decoded.mfaVerified) {
      log.warn('MFA not verified for protected resource', { 
        userId: decoded.userId,
        jti: decoded.jti 
      })
      throw new Error('MFA verification required')
    }
    
    // Validate role if specified
    if (options.allowedRoles && !options.allowedRoles.includes(decoded.role)) {
      log.warn('Role not allowed', { 
        userId: decoded.userId,
        role: decoded.role,
        allowed: options.allowedRoles 
      })
      throw new Error('Insufficient permissions')
    }
    
    // Validate nbf (not before)
    const now = Math.floor(Date.now() / 1000)
    if (decoded.nbf && decoded.nbf > now) {
      log.warn('Token used before valid time', { 
        jti: decoded.jti,
        nbf: decoded.nbf,
        now 
      })
      throw new Error('Token not yet valid')
    }
    
    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      log.debug('Token expired', { error: error.message })
      throw new Error('Token expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      log.warn('Invalid token', { error: error.message })
      throw new Error('Invalid token')
    }
    throw error
  }
}

/**
 * Decode JWT without verification (for inspection)
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload
  } catch {
    return null
  }
}

/**
 * Extract JTI from token (for revocation checks)
 */
export function extractJti(token: string): string | null {
  const decoded = decodeJWT(token)
  return decoded?.jti || null
}

/**
 * Validate JWT secret strength
 */
export function validateSecretStrength(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  const secret = process.env['JWT_SECRET'] ?? ''
  
  if (secret.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters')
  }
  if (secret.length < 64) {
    warnings.push('For maximum security, JWT_SECRET should be 64+ characters')
  }
  if (!/[A-Z]/.test(secret)) {
    warnings.push('JWT_SECRET should contain uppercase letters')
  }
  if (!/[a-z]/.test(secret)) {
    warnings.push('JWT_SECRET should contain lowercase letters')
  }
  if (!/[0-9]/.test(secret)) {
    warnings.push('JWT_SECRET should contain numbers')
  }
  if (!/[^A-Za-z0-9]/.test(secret)) {
    warnings.push('JWT_SECRET should contain special characters')
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  }
}

export { JWT_CONFIG }
