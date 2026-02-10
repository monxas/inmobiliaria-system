import { pgTable, serial, integer, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { users } from './users'

/**
 * Refresh tokens table for JWT refresh token pattern.
 * Access tokens: short-lived (15min), refresh tokens: longer-lived (7d).
 */
export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  family: varchar('family', { length: 64 }).notNull(), // Token family for rotation detection
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
})

export type RefreshToken = InferSelectModel<typeof refreshTokens>
export type CreateRefreshToken = InferInsertModel<typeof refreshTokens>
