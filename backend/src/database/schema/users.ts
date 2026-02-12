import { pgTable, serial, integer, varchar, text, timestamp, inet, pgEnum, bigint } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'agent', 'client']);

// Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }), // nullable for Google-only users
  role: userRoleEnum('role').notNull().default('client'),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  avatarUrl: text('avatar_url'),
  // Google OAuth2 fields
  googleId: varchar('google_id', { length: 255 }).unique(),
  googleEmail: varchar('google_email', { length: 255 }),
  googleAccessToken: text('google_access_token'),
  googleRefreshToken: text('google_refresh_token'),
  googleTokenExpiry: bigint('google_token_expiry', { mode: 'number' }),
  googleScopes: text('google_scopes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// User Sessions
export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Password Resets
export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Types
export type User = InferSelectModel<typeof users>;
export type CreateUser = InferInsertModel<typeof users>;
export type UpdateUser = Partial<Omit<CreateUser, 'id'>>;

export type UserSession = InferSelectModel<typeof userSessions>;
export type CreateUserSession = InferInsertModel<typeof userSessions>;

export type PasswordReset = InferSelectModel<typeof passwordResets>;
export type CreatePasswordReset = InferInsertModel<typeof passwordResets>;
