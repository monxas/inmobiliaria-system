import { createHash, randomBytes } from 'crypto'
import { usersRepository } from '../repositories/users.repository'
import { refreshTokensRepository } from '../repositories/refresh-tokens.repository'
import type { User } from '../database/schema'
import { comparePassword, signJWT } from '../utils/crypto'
import { UnauthorizedError, ValidationError, ForbiddenError } from '../types/errors'
import { logger } from '../lib/logger'
import * as calendarService from './google-calendar.service'

// User without password hash for API responses
export type SafeUser = Omit<User, 'passwordHash'>

// Token configuration
const ACCESS_TOKEN_EXPIRY = process.env['ACCESS_TOKEN_EXPIRY'] ?? '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = Number(process.env['REFRESH_TOKEN_EXPIRY_DAYS']) || 7

interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds until access token expires
}

interface AuthResult {
  user: SafeUser
  tokens: TokenPair
}

interface RefreshResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

interface SessionInfo {
  id: number
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date | null
  lastUsedAt: Date | null
  isCurrent: boolean
}

function omitPassword(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user
  return safeUser
}

/**
 * Hash a refresh token for secure storage
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Generate a cryptographically secure token
 */
function generateSecureToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Generate a token family ID for rotation detection
 */
function generateFamily(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Calculate expiry date for refresh token
 */
function getRefreshTokenExpiry(): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)
  return expiry
}

export class AuthService {
  private log = logger.child({ service: 'AuthService' })

  /**
   * Authenticate user with email/password and issue tokens
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    const user = await usersRepository.findByEmail(email)
    if (!user) {
      this.log.warn('Login failed: user not found', { email })
      throw new UnauthorizedError('Invalid email or password')
    }

    if (!user.passwordHash) {
      this.log.warn('Login failed: Google-only user attempted password login', { email })
      throw new UnauthorizedError('This account uses Google login. Please use "Login with Google".')
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      this.log.warn('Login failed: invalid password', { email, userId: user.id })
      throw new UnauthorizedError('Invalid email or password')
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user, ipAddress, userAgent)

    this.log.info('User logged in', { userId: user.id, email })

    return {
      user: omitPassword(user),
      tokens,
    }
  }

  /**
   * Refresh tokens using a valid refresh token
   */
  async refresh(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshResult> {
    const tokenHash = hashToken(refreshToken)
    const storedToken = await refreshTokensRepository.findValidByHash(tokenHash)

    if (!storedToken) {
      this.log.warn('Refresh failed: token not found or expired')
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    // Token rotation: revoke the old token
    await refreshTokensRepository.revoke(storedToken.id)

    // Get the user
    const user = await usersRepository.findById(storedToken.userId)
    if (!user || user.deletedAt) {
      this.log.warn('Refresh failed: user not found', { userId: storedToken.userId })
      throw new UnauthorizedError('User not found')
    }

    // Generate new token pair with same family
    const tokens = await this.generateTokenPair(user, ipAddress, userAgent, storedToken.family)

    // Update last used on the OLD token (for audit trail)
    await refreshTokensRepository.updateLastUsed(storedToken.id)

    this.log.info('Token refreshed', { userId: user.id })

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    }
  }

  /**
   * Detect refresh token reuse (potential attack)
   * If a revoked token is used again, revoke all tokens in that family
   */
  async detectTokenReuse(refreshToken: string): Promise<boolean> {
    // Hash the token for lookup
    const _tokenHash = hashToken(refreshToken)
    void _tokenHash // Placeholder - will be used for reuse detection

    // Check if this exact token exists but is revoked
    // If so, someone may have stolen and is replaying tokens
    // In production, you'd query for revoked tokens separately

    return false // Placeholder - implement based on your threat model
  }

  /**
   * Logout: revoke the current refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken)
    const storedToken = await refreshTokensRepository.findValidByHash(tokenHash)

    if (storedToken) {
      await refreshTokensRepository.revoke(storedToken.id)
      this.log.info('User logged out', { userId: storedToken.userId })
    }
  }

  /**
   * Logout from all devices: revoke all refresh tokens for a user
   */
  async logoutAllDevices(userId: number): Promise<number> {
    const count = await refreshTokensRepository.revokeAllForUser(userId)
    this.log.info('User logged out from all devices', { userId, sessionsRevoked: count })
    return count
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: number, currentTokenHash?: string): Promise<SessionInfo[]> {
    const sessions = await refreshTokensRepository.getActiveSessionsForUser(userId)

    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      isCurrent: currentTokenHash ? session.tokenHash === currentTokenHash : false,
    }))
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: number, sessionId: number): Promise<void> {
    const sessions = await refreshTokensRepository.getActiveSessionsForUser(userId)
    const session = sessions.find((s) => s.id === sessionId)

    if (!session) {
      throw new ValidationError('sessionId', 'Session not found')
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('Cannot revoke another user\'s session')
    }

    await refreshTokensRepository.revoke(sessionId)
    this.log.info('Session revoked', { userId, sessionId })
  }

  // ==========================================================================
  // Google OAuth2 Authentication
  // ==========================================================================

  /**
   * Get Google OAuth2 consent URL for login/signup
   */
  getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI
    if (!clientId || !redirectUri) {
      throw new Error('Google OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_AUTH_REDIRECT_URI')
    }

    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ]

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: 'google_login', // distinguish from calendar-only OAuth
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  /**
   * Handle Google OAuth2 callback: exchange code, create/find user, return JWT
   */
  async googleCallback(
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth not configured')
    }

    // 1. Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      this.log.error('Google token exchange failed', { error: err })
      throw new UnauthorizedError('Google authentication failed')
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string
      refresh_token?: string
      id_token?: string
      expires_in: number
      scope: string
      token_type: string
    }

    // 2. Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userInfoResponse.ok) {
      throw new UnauthorizedError('Failed to get Google user info')
    }

    const googleUser = await userInfoResponse.json() as {
      id: string
      email: string
      name: string
      picture?: string
      verified_email?: boolean
    }

    // 3. Find or create user
    let user = await usersRepository.findByGoogleId(googleUser.id)

    if (!user) {
      // Check if user exists with same email (link accounts)
      user = await usersRepository.findByEmail(googleUser.email)

      if (user) {
        // Link existing user to Google account
        await usersRepository.update(user.id, {
          googleId: googleUser.id,
          googleEmail: googleUser.email,
          googleAccessToken: tokenData.access_token,
          googleRefreshToken: tokenData.refresh_token || undefined,
          googleTokenExpiry: Date.now() + (tokenData.expires_in * 1000),
          googleScopes: tokenData.scope,
          avatarUrl: user.avatarUrl || googleUser.picture || undefined,
        } as any)
        // Re-fetch with updated fields
        user = await usersRepository.findById(user.id)
      } else {
        // Create new user from Google profile
        user = await usersRepository.createWithPassword({
          email: googleUser.email,
          passwordHash: null as any, // Google-only user, no password
          fullName: googleUser.name,
          role: 'agent', // Default role for Google signups
          avatarUrl: googleUser.picture || undefined,
          googleId: googleUser.id,
          googleEmail: googleUser.email,
          googleAccessToken: tokenData.access_token,
          googleRefreshToken: tokenData.refresh_token || undefined,
          googleTokenExpiry: Date.now() + (tokenData.expires_in * 1000),
          googleScopes: tokenData.scope,
        } as any)
      }
    } else {
      // Update tokens for existing Google user
      await usersRepository.updateGoogleTokens(user.id, {
        googleAccessToken: tokenData.access_token,
        googleRefreshToken: tokenData.refresh_token,
        googleTokenExpiry: Date.now() + (tokenData.expires_in * 1000),
        googleScopes: tokenData.scope,
      })
    }

    if (!user) {
      throw new Error('Failed to create or find user')
    }

    // 4. Also save tokens to google_calendar_tokens table for Calendar API
    try {
      await calendarService.saveTokens(user.id, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || '',
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        expiry_date: Date.now() + (tokenData.expires_in * 1000),
      })
    } catch (err) {
      this.log.warn('Failed to save calendar tokens (table may not exist yet)', { error: String(err) })
    }

    // 5. Generate app JWT tokens
    const tokens = await this.generateTokenPair(user, ipAddress, userAgent)

    this.log.info('User logged in via Google', { userId: user.id, email: user.email, googleId: googleUser.id })

    return {
      user: omitPassword(user),
      tokens,
    }
  }

  /**
   * Generate access + refresh token pair
   */
  private async generateTokenPair(
    user: User,
    ipAddress?: string,
    userAgent?: string,
    existingFamily?: string
  ): Promise<TokenPair> {
    // Access token (short-lived)
    const accessToken = signJWT(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        full_name: user.fullName,
        type: 'access',
      },
      ACCESS_TOKEN_EXPIRY
    )

    // Refresh token (longer-lived, stored securely)
    const refreshTokenRaw = generateSecureToken()
    const refreshTokenHash = hashToken(refreshTokenRaw)
    const family = existingFamily || generateFamily()

    await refreshTokensRepository.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      family,
      expiresAt: getRefreshTokenExpiry(),
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    })

    // Parse expiry for response (convert "15m" -> seconds)
    const expiresIn = this.parseExpiryToSeconds(ACCESS_TOKEN_EXPIRY)

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      expiresIn,
    }
  }

  /**
   * Parse JWT expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/)
    if (!match || !match[1] || !match[2]) return 900 // default 15 minutes

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 's':
        return value
      case 'm':
        return value * 60
      case 'h':
        return value * 3600
      case 'd':
        return value * 86400
      default:
        return 900
    }
  }
}

export const authService = new AuthService()
