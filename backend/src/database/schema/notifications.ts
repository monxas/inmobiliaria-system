/**
 * @fileoverview Notifications Schema - Database tables for notification system
 * Level 3 - Notifications & Email System
 */

import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from './users';

// =============================================================================
// Enums
// =============================================================================

export const notificationTypeEnum = pgEnum('notification_type', [
  'info',
  'success',
  'warning',
  'error',
  'property_inquiry',
  'document_shared',
  'property_update',
  'client_update',
  'system',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
  'push',
  'sms',
]);

export const emailStatusEnum = pgEnum('email_status', [
  'pending',
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'bounced',
]);

export const emailTemplateEnum = pgEnum('email_template', [
  'welcome',
  'password_reset',
  'property_inquiry',
  'document_shared',
  'weekly_report',
  'monthly_report',
  'custom',
]);

// =============================================================================
// Notification Preferences
// =============================================================================

export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  // In-app notifications
  inAppEnabled: boolean('in_app_enabled').notNull().default(true),
  inAppPropertyInquiry: boolean('in_app_property_inquiry').notNull().default(true),
  inAppDocumentShared: boolean('in_app_document_shared').notNull().default(true),
  inAppPropertyUpdates: boolean('in_app_property_updates').notNull().default(true),
  inAppClientUpdates: boolean('in_app_client_updates').notNull().default(true),
  inAppSystemAlerts: boolean('in_app_system_alerts').notNull().default(true),

  // Email notifications
  emailEnabled: boolean('email_enabled').notNull().default(true),
  emailPropertyInquiry: boolean('email_property_inquiry').notNull().default(true),
  emailDocumentShared: boolean('email_document_shared').notNull().default(true),
  emailPropertyUpdates: boolean('email_property_updates').notNull().default(false),
  emailClientUpdates: boolean('email_client_updates').notNull().default(false),
  emailWeeklyReport: boolean('email_weekly_report').notNull().default(true),
  emailMonthlyReport: boolean('email_monthly_report').notNull().default(true),
  emailMarketingCampaigns: boolean('email_marketing_campaigns').notNull().default(false),

  // Push notifications (future)
  pushEnabled: boolean('push_enabled').notNull().default(false),

  // SMS notifications (future)
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  smsPhone: varchar('sms_phone', { length: 20 }),

  // Quiet hours
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }), // "22:00"
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }), // "08:00"
  quietHoursTimezone: varchar('quiet_hours_timezone', { length: 50 }).default('Europe/Madrid'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// =============================================================================
// In-App Notifications
// =============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    type: notificationTypeEnum('type').notNull().default('info'),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),

    // Optional link to related entity
    entityType: varchar('entity_type', { length: 50 }), // 'property', 'client', 'document'
    entityId: integer('entity_id'),

    // Action URL (for clicks)
    actionUrl: varchar('action_url', { length: 500 }),

    // Extra metadata
    metadata: jsonb('metadata'),

    // Read status
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),

    // Archived (hidden but not deleted)
    isArchived: boolean('is_archived').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    userUnreadIdx: index('notifications_user_unread_idx').on(table.userId, table.isRead),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  })
);

// =============================================================================
// Email Queue
// =============================================================================

export const emailQueue = pgTable(
  'email_queue',
  {
    id: serial('id').primaryKey(),

    // Recipient
    toEmail: varchar('to_email', { length: 255 }).notNull(),
    toName: varchar('to_name', { length: 255 }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),

    // Email content
    subject: varchar('subject', { length: 500 }).notNull(),
    templateName: emailTemplateEnum('template_name').notNull(),
    templateData: jsonb('template_data'), // Variables for template rendering

    // Rendered content (cached after first render)
    htmlContent: text('html_content'),
    textContent: text('text_content'),

    // Status tracking
    status: emailStatusEnum('status').notNull().default('pending'),
    priority: integer('priority').notNull().default(5), // 1-10, lower = higher priority

    // Retry logic
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),

    // Delivery tracking
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),

    // External provider data
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    providerResponse: jsonb('provider_response'),

    // Error tracking
    errorMessage: text('error_message'),
    errorCode: varchar('error_code', { length: 50 }),

    // Metadata
    tags: jsonb('tags'), // ["welcome", "onboarding"]
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    statusIdx: index('email_queue_status_idx').on(table.status),
    nextAttemptIdx: index('email_queue_next_attempt_idx').on(table.nextAttemptAt),
    userIdIdx: index('email_queue_user_id_idx').on(table.userId),
    createdAtIdx: index('email_queue_created_at_idx').on(table.createdAt),
  })
);

// =============================================================================
// Email Templates (custom templates stored in DB)
// =============================================================================

export const emailTemplates = pgTable('email_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),

  // Template content (Handlebars)
  subject: varchar('subject', { length: 500 }).notNull(),
  htmlTemplate: text('html_template').notNull(),
  textTemplate: text('text_template'),

  // Template variables schema (for validation/documentation)
  variablesSchema: jsonb('variables_schema'),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false), // System templates can't be deleted

  // Audit
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// =============================================================================
// Types
// =============================================================================

export type NotificationPreferences = InferSelectModel<typeof notificationPreferences>;
export type CreateNotificationPreferences = InferInsertModel<typeof notificationPreferences>;
export type UpdateNotificationPreferences = Partial<Omit<CreateNotificationPreferences, 'id' | 'userId'>>;

export type Notification = InferSelectModel<typeof notifications>;
export type CreateNotification = InferInsertModel<typeof notifications>;

export type EmailQueueItem = InferSelectModel<typeof emailQueue>;
export type CreateEmailQueueItem = InferInsertModel<typeof emailQueue>;
export type UpdateEmailQueueItem = Partial<Omit<CreateEmailQueueItem, 'id'>>;

export type EmailTemplate = InferSelectModel<typeof emailTemplates>;
export type CreateEmailTemplate = InferInsertModel<typeof emailTemplates>;
export type UpdateEmailTemplate = Partial<Omit<CreateEmailTemplate, 'id'>>;
