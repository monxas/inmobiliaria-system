import type { Context } from 'hono'
import { authService } from '../services/auth.service'
import { usersService } from '../services/users.service'
import { LoginSchema, RegisterSchema } from '../validation/schemas'
import { ValidationError, UnauthorizedError } from '../types/errors'
import { apiResponse, apiError } from '../utils/response'
import type { AppVariables } from '../types'
import { logger } from '../lib/logger'

const log = logger.child({ controller: 'AuthController' })

/**
 * Extract client IP from request
 */
function getClientIP(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * Extract refresh token from cookie or body
 */
function extractRefreshToken(c: Context, body?: Record<string, unknown>): string | null {
  // Try cookie first (more secure)
  const cookie = c.req.header('cookie')
  if (cookie) {
    const match = cookie.match(/refresh_token=([^;]+)/)
    if (match) return match[1] ?? null
  }

  // Fall back to body
  const token = body?.['refreshToken']
  return typeof token === 'string' ? token : null
}

export class AuthController {
  /**
   * POST /auth/login
   * Authenticate user and return access + refresh tokens
   */
  async login(c: Context) {
    try {
      const input = await c.req.json()
      const result = LoginSchema.safeParse(input)

      if (!result.success) {
        const firstError = result.error.errors[0]
        const message = firstError?.message ?? 'Validation failed'
        return c.json(apiError(`Validation failed: ${message}`, 400), 400)
      }

      const ipAddress = getClientIP(c)
      const userAgent = c.req.header('user-agent') || undefined

      const authResult = await authService.login(
        result.data.email,
        result.data.password,
        ipAddress,
        userAgent
      )

      // Set refresh token as httpOnly cookie
      c.header(
        'Set-Cookie',
        `refresh_token=${authResult.tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 3600}`
      )

      return c.json(
        apiResponse({
          user: authResult.user,
          accessToken: authResult.tokens.accessToken,
          expiresIn: authResult.tokens.expiresIn,
        })
      )
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return c.json(apiError(error.message, 401), 401)
      }
      log.error('Login error', { error: String(error) })
      return c.json(apiError('Authentication failed', 500), 500)
    }
  }

  /**
   * POST /auth/register
   * Create new user account (role forced to 'client')
   */
  async register(c: Context) {
    try {
      const input = await c.req.json()
      const result = RegisterSchema.safeParse(input)

      if (!result.success) {
        const firstError = result.error.errors[0]
        const message = firstError?.message ?? 'Validation failed'
        return c.json(apiError(`Validation failed: ${message}`, 400), 400)
      }

      // Force role to 'client' for self-registration
      const userInput = { ...result.data, role: 'client' as const }
      const user = await usersService.create(userInput)

      return c.json(apiResponse(user), 201)
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json(apiError(error.message, 400, error.code, error.details), 400)
      }
      log.error('Registration error', { error: String(error) })
      return c.json(apiError('Registration failed', 500), 500)
    }
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}))
      const refreshToken = extractRefreshToken(c, body)

      if (!refreshToken) {
        return c.json(apiError('Refresh token required', 400), 400)
      }

      const ipAddress = getClientIP(c)
      const userAgent = c.req.header('user-agent') || undefined

      const result = await authService.refresh(refreshToken, ipAddress, userAgent)

      // Set new refresh token cookie
      c.header(
        'Set-Cookie',
        `refresh_token=${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 3600}`
      )

      return c.json(
        apiResponse({
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        })
      )
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        // Clear the invalid refresh token cookie
        c.header('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0')
        return c.json(apiError(error.message, 401), 401)
      }
      log.error('Refresh error', { error: String(error) })
      return c.json(apiError('Token refresh failed', 500), 500)
    }
  }

  /**
   * POST /auth/logout
   * Revoke current refresh token
   */
  async logout(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}))
      const refreshToken = extractRefreshToken(c, body)

      if (refreshToken) {
        await authService.logout(refreshToken)
      }

      // Clear cookie
      c.header('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0')

      return c.json(apiResponse({ message: 'Logged out successfully' }))
    } catch (error) {
      log.error('Logout error', { error: String(error) })
      // Still clear cookie even on error
      c.header('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0')
      return c.json(apiResponse({ message: 'Logged out' }))
    }
  }

  /**
   * POST /auth/logout-all
   * Revoke all refresh tokens for the authenticated user
   */
  async logoutAll(c: Context<{ Variables: AppVariables }>) {
    try {
      const user = c.get('user')
      if (!user) {
        return c.json(apiError('Not authenticated', 401), 401)
      }

      const count = await authService.logoutAllDevices(user.id)

      // Clear current cookie
      c.header('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0')

      return c.json(apiResponse({ message: `Logged out from ${count} devices` }))
    } catch (error) {
      log.error('Logout all error', { error: String(error) })
      return c.json(apiError('Failed to logout from all devices', 500), 500)
    }
  }

  /**
   * GET /auth/sessions
   * Get active sessions for authenticated user
   */
  async getSessions(c: Context<{ Variables: AppVariables }>) {
    try {
      const user = c.get('user')
      if (!user) {
        return c.json(apiError('Not authenticated', 401), 401)
      }

      const sessions = await authService.getActiveSessions(user.id)

      return c.json(apiResponse(sessions))
    } catch (error) {
      log.error('Get sessions error', { error: String(error) })
      return c.json(apiError('Failed to get sessions', 500), 500)
    }
  }

  /**
   * DELETE /auth/sessions/:id
   * Revoke a specific session
   */
  async revokeSession(c: Context<{ Variables: AppVariables }>) {
    try {
      const user = c.get('user')
      if (!user) {
        return c.json(apiError('Not authenticated', 401), 401)
      }

      const sessionId = Number(c.req.param('id'))
      if (!sessionId) {
        return c.json(apiError('Invalid session ID', 400), 400)
      }

      await authService.revokeSession(user.id, sessionId)

      return c.json(apiResponse({ message: 'Session revoked' }))
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json(apiError(error.message, 400), 400)
      }
      log.error('Revoke session error', { error: String(error) })
      return c.json(apiError('Failed to revoke session', 500), 500)
    }
  }

  /**
   * GET /auth/me
   * Get current user profile
   */
  async me(c: Context<{ Variables: AppVariables }>) {
    try {
      const authUser = c.get('user')
      if (!authUser) {
        return c.json(apiError('Not authenticated', 401), 401)
      }

      const user = await usersService.findById(authUser.id)
      if (!user) {
        return c.json(apiError('User not found', 404), 404)
      }

      return c.json(apiResponse(user))
    } catch (error) {
      log.error('Me error', { error: String(error) })
      return c.json(apiError('Failed to fetch user profile', 500), 500)
    }
  }

  /**
   * PUT /auth/me
   * Update current user profile (cannot change role)
   */
  async updateMe(c: Context<{ Variables: AppVariables }>) {
    try {
      const authUser = c.get('user')
      if (!authUser) {
        return c.json(apiError('Not authenticated', 401), 401)
      }

      const input = await c.req.json()
      // Prevent role self-escalation
      delete input.role

      const user = await usersService.update(authUser.id, input)
      return c.json(apiResponse(user))
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.json(apiError(error.message, 400, error.code, error.details), 400)
      }
      log.error('Update me error', { error: String(error) })
      return c.json(apiError('Failed to update profile', 500), 500)
    }
  }
}

export const authController = new AuthController()
