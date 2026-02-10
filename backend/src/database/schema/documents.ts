import { pgTable, serial, varchar, text, timestamp, integer, boolean, inet, pgEnum } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { users } from './users';
import { properties } from './properties';
import { clients } from './clients';

// Enums
export const fileCategoryEnum = pgEnum('file_category', ['property_docs', 'property_images', 'client_docs', 'contracts', 'other']);
export const notificationTypeEnum = pgEnum('notification_type', ['document_uploaded', 'link_expiring', 'viewing_scheduled', 'property_updated', 'system']);

// Documents
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  category: fileCategoryEnum('category').notNull().default('other'),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'cascade' }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  accessToken: varchar('access_token', { length: 255 }).unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  downloadCount: integer('download_count').default(0),
  isPublic: boolean('is_public').default(false),
  uploadedBy: integer('uploaded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// File Access Logs
export const fileAccessLogs = pgTable('file_access_logs', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  accessedBy: integer('accessed_by').references(() => users.id),
  ipAddress: inet('ip_address').notNull(),
  userAgent: text('user_agent'),
  accessTokenUsed: varchar('access_token_used', { length: 255 }),
  accessedAt: timestamp('accessed_at', { withTimezone: true }).defaultNow(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'set null' }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  documentId: integer('document_id').references(() => documents.id, { onDelete: 'set null' }),
  readAt: timestamp('read_at', { withTimezone: true }),
  sentViaEmail: boolean('sent_via_email').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Email Templates
export const emailTemplates = pgTable('email_templates', {
  id: serial('id').primaryKey(),
  templateKey: varchar('template_key', { length: 100 }).unique().notNull(),
  subjectTemplate: text('subject_template').notNull(),
  bodyTemplate: text('body_template').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Types
export type Document = InferSelectModel<typeof documents>;
export type CreateDocument = InferInsertModel<typeof documents>;
export type UpdateDocument = Partial<Omit<CreateDocument, 'id'>>;

export type FileAccessLog = InferSelectModel<typeof fileAccessLogs>;
export type CreateFileAccessLog = InferInsertModel<typeof fileAccessLogs>;

export type Notification = InferSelectModel<typeof notifications>;
export type CreateNotification = InferInsertModel<typeof notifications>;

export type EmailTemplate = InferSelectModel<typeof emailTemplates>;
export type CreateEmailTemplate = InferInsertModel<typeof emailTemplates>;
