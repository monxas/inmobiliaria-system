import { pgTable, serial, integer, varchar, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from './users';

// Permission definitions
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  resource: varchar('resource', { length: 50 }).notNull(), // 'properties', 'clients', 'users', 'documents'
  action: varchar('action', { length: 50 }).notNull(), // 'create', 'read', 'update', 'delete', 'manage'
  isSystem: boolean('is_system').default(false), // System permissions can't be deleted
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Role definitions (extends the basic roles in users)
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  level: integer('level').default(0), // Higher = more access
  color: varchar('color', { length: 7 }), // hex color
  isSystem: boolean('is_system').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Role-Permission mapping
export const rolePermissions = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow(),
  grantedBy: integer('granted_by').references(() => users.id),
}, (table) => ({
  uniqueRolePermission: unique().on(table.roleId, table.permissionId),
}));

// User-specific permission overrides (beyond role)
export const userPermissionOverrides = pgTable('user_permission_overrides', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  granted: boolean('granted').notNull(), // true = grant, false = revoke
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow(),
  grantedBy: integer('granted_by').references(() => users.id),
}, (table) => ({
  uniqueUserPermission: unique().on(table.userId, table.permissionId),
}));

// User role assignments (allows multiple roles per user)
export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  isPrimary: boolean('is_primary').default(false),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  assignedBy: integer('assigned_by').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  uniqueUserRole: unique().on(table.userId, table.roleId),
}));

// Two-Factor Authentication secrets
export const twoFactorSecrets = pgTable('two_factor_secrets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  secret: varchar('secret', { length: 255 }).notNull(), // Encrypted TOTP secret
  backupCodes: text('backup_codes'), // Encrypted JSON array of backup codes
  isEnabled: boolean('is_enabled').default(false),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Account Status tracking
export const accountStatus = pgTable('account_status', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'active', 'suspended', 'deactivated'
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspendedReason: text('suspended_reason'),
  suspendedBy: integer('suspended_by').references(() => users.id),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  deactivatedReason: text('deactivated_reason'),
  lastStatusChange: timestamp('last_status_change', { withTimezone: true }).defaultNow(),
  passwordLastChanged: timestamp('password_last_changed', { withTimezone: true }),
  passwordExpiresAt: timestamp('password_expires_at', { withTimezone: true }),
  mustChangePassword: boolean('must_change_password').default(false),
  lockoutCount: integer('lockout_count').default(0),
  lastLockoutAt: timestamp('last_lockout_at', { withTimezone: true }),
});

// Admin Impersonation logs
export const impersonationLogs = pgTable('impersonation_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  targetUserId: integer('target_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reason: text('reason'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  ipAddress: varchar('ip_address', { length: 45 }),
  actionsPerformed: integer('actions_performed').default(0),
});

// Types
export type Permission = InferSelectModel<typeof permissions>;
export type CreatePermission = InferInsertModel<typeof permissions>;

export type Role = InferSelectModel<typeof roles>;
export type CreateRole = InferInsertModel<typeof roles>;

export type RolePermission = InferSelectModel<typeof rolePermissions>;
export type CreateRolePermission = InferInsertModel<typeof rolePermissions>;

export type UserPermissionOverride = InferSelectModel<typeof userPermissionOverrides>;
export type CreateUserPermissionOverride = InferInsertModel<typeof userPermissionOverrides>;

export type UserRole = InferSelectModel<typeof userRoles>;
export type CreateUserRole = InferInsertModel<typeof userRoles>;

export type TwoFactorSecret = InferSelectModel<typeof twoFactorSecrets>;
export type CreateTwoFactorSecret = InferInsertModel<typeof twoFactorSecrets>;

export type AccountStatusRecord = InferSelectModel<typeof accountStatus>;
export type CreateAccountStatus = InferInsertModel<typeof accountStatus>;

export type ImpersonationLog = InferSelectModel<typeof impersonationLogs>;
export type CreateImpersonationLog = InferInsertModel<typeof impersonationLogs>;
