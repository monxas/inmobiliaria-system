import { eq, and, lt, gt } from 'drizzle-orm'
import { db } from '../database/connection'
import { refreshTokens, type RefreshToken, type CreateRefreshToken } from '../database/schema'
import { logger } from '../lib/logger'

export class RefreshTokensRepository {
  /**
   * Create a new refresh token
   */
  async create(data: CreateRefreshToken): Promise<RefreshToken> {
    const [token] = await db.insert(refreshTokens).values(data).returning()
    if (!token) {
      throw new Error('Failed to create refresh token')
    }
    return token
  }

  /**
   * Find a valid (non-expired, non-revoked) refresh token by its hash
   */
  async findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    const now = new Date()
    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, now)
        )
      )
      .limit(1)

    return token || null
  }

  /**
   * Mark a specific token as revoked
   */
  async revoke(id: number): Promise<void> {
    await db.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.id, id))
  }

  /**
   * Revoke all tokens in a family (for reuse detection)
   */
  async revokeFamily(family: string): Promise<number> {
    const result = await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.family, family))
      .returning({ id: refreshTokens.id })

    logger.warn('Token family revoked (possible reuse attack)', { family, count: result.length })
    return result.length
  }

  /**
   * Revoke all tokens for a user (logout from all devices)
   */
  async revokeAllForUser(userId: number): Promise<number> {
    const result = await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.userId, userId))
      .returning({ id: refreshTokens.id })

    return result.length
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: number): Promise<void> {
    await db.update(refreshTokens).set({ lastUsedAt: new Date() }).where(eq(refreshTokens.id, id))
  }

  /**
   * Cleanup expired tokens (for periodic maintenance)
   */
  async deleteExpired(): Promise<number> {
    const result = await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id })

    return result.length
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessionsForUser(userId: number): Promise<RefreshToken[]> {
    const now = new Date()
    return db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, now)
        )
      )
  }
}

export const refreshTokensRepository = new RefreshTokensRepository()
