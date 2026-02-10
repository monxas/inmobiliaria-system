import { pgTable, serial, integer, varchar, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from './users';

// User Profiles - Extended profile information
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  bio: text('bio'),
  jobTitle: varchar('job_title', { length: 100 }),
  department: varchar('department', { length: 100 }),
  location: varchar('location', { length: 255 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  language: varchar('language', { length: 10 }).default('es'),
  avatarPath: varchar('avatar_path', { length: 500 }),
  coverImagePath: varchar('cover_image_path', { length: 500 }),
  socialLinks: jsonb('social_links').$type<{
    linkedin?: string;
    twitter?: string;
    website?: string;
  }>(),
  notificationPreferences: jsonb('notification_preferences').$type<{
    email: boolean;
    push: boolean;
    sms: boolean;
    types: string[];
  }>().default({ email: true, push: true, sms: false, types: ['all'] }),
  profileCompleteness: integer('profile_completeness').default(0), // 0-100
  onboardingCompleted: boolean('onboarding_completed').default(false),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// User Groups/Teams
export const userGroups = pgTable('user_groups', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // hex color
  iconName: varchar('icon_name', { length: 50 }),
  parentId: integer('parent_id').references((): typeof userGroups => userGroups),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  isActive: boolean('is_active').default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// User Group Memberships
export const userGroupMemberships = pgTable('user_group_memberships', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  groupId: integer('group_id').references(() => userGroups.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).default('member'), // 'owner', 'admin', 'member'
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  invitedBy: integer('invited_by').references(() => users.id),
});

// Activity History
export const userActivities = pgTable('user_activities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'login', 'logout', 'create', 'update', 'delete', 'view'
  entityType: varchar('entity_type', { length: 50 }), // 'property', 'client', 'document'
  entityId: integer('entity_id'),
  description: text('description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Login History
export const loginHistory = pgTable('login_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  success: boolean('success').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  geoLocation: jsonb('geo_location').$type<{
    country?: string;
    city?: string;
    region?: string;
    lat?: number;
    lon?: number;
  }>(),
  failureReason: varchar('failure_reason', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Types
export type UserProfile = InferSelectModel<typeof userProfiles>;
export type CreateUserProfile = InferInsertModel<typeof userProfiles>;
export type UpdateUserProfile = Partial<Omit<CreateUserProfile, 'id' | 'userId'>>;

export type UserGroup = InferSelectModel<typeof userGroups>;
export type CreateUserGroup = InferInsertModel<typeof userGroups>;

export type UserGroupMembership = InferSelectModel<typeof userGroupMemberships>;
export type CreateUserGroupMembership = InferInsertModel<typeof userGroupMemberships>;

export type UserActivity = InferSelectModel<typeof userActivities>;
export type CreateUserActivity = InferInsertModel<typeof userActivities>;

export type LoginHistoryEntry = InferSelectModel<typeof loginHistory>;
export type CreateLoginHistoryEntry = InferInsertModel<typeof loginHistory>;
