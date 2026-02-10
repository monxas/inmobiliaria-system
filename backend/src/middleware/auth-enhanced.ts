/**
 * Enhanced Authentication Middleware
 * 
 * Integrates:
 * - Advanced JWT validation with aud/iss checks
 * - Account lockout integration
 * - Session validation
 * - MFA verification status
 * - Audit trail
 */

import type { Context, Next } from 'hono'
import { apiError } from '../utils/response'
import {
  verifyAdvancedJWT,
  checkLockoutStatus,
  validateSession,
  updateSessionActivity,
  audit,
  AuditAction,
  createAuditContext,
  isMFAEnabled,
  type TokenType,
} from '../lib/security'
import type { UserRole, AppVariables, AuthUser } from '../types'
import { logger } from '../lib/logger'

const log = logger.child({ middleware: 'auth-enhanced' })

function extractToken(c: Context): string | null {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return null
}

function getClientIP(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
         c.req.header('x-real-ip') ||
         'unknown'
}

export interface AuthOptions {
  requireMFA?: boolean
  allowedRoles?: UserRole[]
  requireSession?: boolean
  tokenType?: TokenType
}

/**
 * Enhanced authentication middleware
 */
export const requireAuthEnhanced = (options?: AuthOptions) => {
  const {
    requireMFA = false,
    allowedRoles,
    requireSession = true,
    tokenType = 'access',
  } = options || {}

  return async (c: Context<{ Variables: AppVariables }>, next: Next): Promise<Response | void> => {
    const ip = getClientIP(c)
    const userAgent = c.req.header('user-agent') || 'unknown'

    // Extract token
    const token = extractToken(c)
    if (!token) {
      return c.json(apiError('Authentication required', 401, 'AUTH_REQUIRED'), 401)
    }

    try {
      // Verify JWT with advanced validation
      const payload = verifyAdvancedJWT(token, {
        type: tokenType,
        requireMFA,
        allowedRoles,
      })

      // Check account lockout
      const lockoutStatus = checkLockoutStatus(payload.email)
      if (lockoutStatus.isLocked) {
        log.warn('Authentication attempt on locked account', {
          email: payload.email,
          ip,
          lockedUntil: lockoutStatus.lockedUntil,
        })
        
        return c.json(apiError(
          `Account is locked. Try again in ${lockoutStatus.lockoutDuration} seconds.`,
          'ACCOUNT_LOCKED',
          423
        ), 423)
      }

      // Check MFA if required but not verified
      if (requireMFA && !payload.mfaVerified) {
        const mfaEnabled = isMFAEnabled(payload.userId)
        if (mfaEnabled) {
          return c.json(apiError(
            'MFA verification required',
            'MFA_REQUIRED',
            403
          ), 403)
        }
        // If MFA not enabled for user, allow through
      }

      // Validate session if required
      if (requireSession && payload.sessionId) {
        const sessionValidation = validateSession(
          payload.sessionId,
          ip,
          userAgent
        )
        
        if (!sessionValidation.valid) {
          log.warn('Session validation failed', {
            userId: payload.userId,
            sessionId: payload.sessionId,
            reason: sessionValidation.reason,
          })
          
          return c.json(apiError(
            sessionValidation.reason || 'Session invalid',
            'SESSION_INVALID',
            401
          ), 401)
        }
        
        // Update session activity
        updateSessionActivity(payload.sessionId)
      }

      // Set user in context
      const user: AuthUser = {
        id: payload.userId,
        email: payload.email,
        role: payload.role as UserRole,
        fullName: payload.fullName,
      }
      c.set('user', user)
      c.set('sessionId', payload.sessionId)
      c.set('jti', payload.jti)

      await next()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token'
      
      log.debug('Authentication failed', { error: message, ip })
      
      // Map error types to appropriate responses
      if (message === 'Token expired') {
        return c.json(apiError('Token expired', 401, 'TOKEN_EXPIRED'), 401)
      }
      if (message === 'MFA verification required') {
        return c.json(apiError('MFA verification required', 403, 'MFA_REQUIRED'), 403)
      }
      if (message === 'Insufficient permissions') {
        return c.json(apiError('Insufficient permissions', 403, 'FORBIDDEN'), 403)
      }
      
      return c.json(apiError('Invalid token', 'INVALID_TOKEN', 401), 401)
    }
  }
}

/**
 * Role-based access control middleware
 */
export const requireRoleEnhanced = (allowedRoles: UserRole[]) => {
  return requireAuthEnhanced({ allowedRoles })
}

/**
 * MFA-required middleware
 */
export const requireMFA = () => {
  return requireAuthEnhanced({ requireMFA: true })
}

/**
 * API key authentication middleware
 */
export const requireAPIKey = () => {
  return async (c: Context<{ Variables: AppVariables }>, next: Next): Promise<Response | void> => {
    const apiKey = c.req.header('X-API-Key')
    const apiKeyId = c.req.header('X-API-Key-ID')
    
    if (!apiKey || !apiKeyId) {
      return c.json(apiError('API key required', 'API_KEY_REQUIRED', 401), 401)
    }
    
    // In production, validate against stored API keys
    // For now, this is a placeholder for the infrastructure
    
    // Audit API key usage
    audit(
      AuditAction.READ,
      createAuditContext(c),
      {
        entityType: 'api',
        metadata: { apiKeyId },
      }
    )
    
    await next()
  }
}

/**
 * Ownership verification with audit
 */
export const requireOwnershipEnhanced = (
  getOwnerId: (c: Context<{ Variables: AppVariables }>) => Promise<number | null>
) => {
  return async (c: Context<{ Variables: AppVariables }>, next: Next): Promise<Response | void> => {
    const user = c.get('user')
    if (!user) {
      return c.json(apiError('Authentication required', 401, 'AUTH_REQUIRED'), 401)
    }

    // Admins bypass ownership check
    if (user.role === 'admin') {
      await next()
      return
    }

    const ownerId = await getOwnerId(c)
    if (ownerId === null) {
      return c.json(apiError('Resource not found', 'NOT_FOUND', 404), 404)
    }

    if (ownerId !== user.id) {
      // Audit unauthorized access attempt
      audit(
        AuditAction.SUSPICIOUS_ACTIVITY,
        createAuditContext(c),
        {
          entityType: 'resource',
          metadata: {
            action: 'unauthorized_access_attempt',
            requestedResource: c.req.path,
            resourceOwnerId: ownerId,
          },
        }
      )
      
      return c.json(apiError('You do not have access to this resource', 'FORBIDDEN', 403), 403)
    }

    await next()
  }
}

/**
 * Sensitive operation middleware - requires recent authentication
 */
export const requireRecentAuth = (maxAgeMinutes: number = 15) => {
  return async (c: Context<{ Variables: AppVariables }>, next: Next): Promise<Response | void> => {
    const user = c.get('user')
    if (!user) {
      return c.json(apiError('Authentication required', 401, 'AUTH_REQUIRED'), 401)
    }

    const token = extractToken(c)
    if (!token) {
      return c.json(apiError('Authentication required', 401, 'AUTH_REQUIRED'), 401)
    }

    try {
      const payload = verifyAdvancedJWT(token, { type: 'access' })
      const tokenAge = Date.now() / 1000 - payload.iat
      const maxAgeSeconds = maxAgeMinutes * 60

      if (tokenAge > maxAgeSeconds) {
        return c.json(apiError(
          'Please re-authenticate for this sensitive operation',
          'REAUTH_REQUIRED',
          401
        ), 401)
      }

      await next()
    } catch {
      return c.json(apiError('Invalid token', 'INVALID_TOKEN', 401), 401)
    }
  }
}
