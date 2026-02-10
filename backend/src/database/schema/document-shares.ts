/**
 * @fileoverview Document sharing schema with advanced security features.
 * 
 * Supports:
 * - Share tokens with configurable expiration
 * - Permission levels (view, download, edit)
 * - Password protection
 * - Access logging and audit trail
 * - Public/private modes
 */

import { pgTable, serial, varchar, text, timestamp, integer, boolean, inet, pgEnum, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { users } from './users';
import { documents } from './documents';
import { clients } from './clients';

// ============================================
// Enums
// ============================================

export const sharePermissionEnum = pgEnum('share_permission', ['view', 'download', 'edit']);
export const shareTypeEnum = pgEnum('share_type', ['link', 'email', 'client']);
export const accessActionEnum = pgEnum('access_action', ['view', 'download', 'preview', 'share', 'revoke']);

// ============================================
// Document Shares
// ============================================

/**
 * Document share links with security features.
 * Each share creates a unique token with configurable access.
 */
export const documentShares = pgTable('document_shares', {
  id: serial('id').primaryKey(),
  
  // Token identification
  shareToken: uuid('share_token').defaultRandom().unique().notNull(),
  shortCode: varchar('short_code', { length: 12 }).unique(), // Optional short URL code
  
  // Document reference
  documentId: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  
  // Share configuration
  shareType: shareTypeEnum('share_type').notNull().default('link'),
  permission: sharePermissionEnum('permission').notNull().default('view'),
  
  // Access control
  passwordHash: varchar('password_hash', { length: 255 }), // Null = no password
  maxDownloads: integer('max_downloads'), // Null = unlimited
  currentDownloads: integer('current_downloads').default(0).notNull(),
  maxViews: integer('max_views'), // Null = unlimited
  currentViews: integer('current_views').default(0).notNull(),
  
  // Time constraints
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  activatesAt: timestamp('activates_at', { withTimezone: true }), // Optional scheduled activation
  
  // Email sharing
  recipientEmail: varchar('recipient_email', { length: 255 }),
  recipientName: varchar('recipient_name', { length: 255 }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  
  // Notification settings
  notifyOnAccess: boolean('notify_on_access').default(false),
  notifyEmail: varchar('notify_email', { length: 255 }),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: integer('revoked_by').references(() => users.id),
  revokeReason: text('revoke_reason'),
  
  // Metadata
  message: text('message'), // Optional message to recipient
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  
  // Audit
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_shares_document').on(table.documentId),
  index('idx_shares_token').on(table.shareToken),
  index('idx_shares_short_code').on(table.shortCode),
  index('idx_shares_client').on(table.clientId),
  index('idx_shares_expires').on(table.expiresAt),
  index('idx_shares_active').on(table.isActive),
]);

// ============================================
// Share Access Log
// ============================================

/**
 * Detailed access log for audit trail.
 * Records every access attempt with full context.
 */
export const shareAccessLogs = pgTable('share_access_logs', {
  id: serial('id').primaryKey(),
  
  // Reference
  shareId: integer('share_id').references(() => documentShares.id, { onDelete: 'cascade' }).notNull(),
  documentId: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  
  // Access details
  action: accessActionEnum('action').notNull(),
  success: boolean('success').default(true).notNull(),
  failureReason: varchar('failure_reason', { length: 255 }),
  
  // Accessor info
  accessedBy: integer('accessed_by').references(() => users.id), // Null = anonymous
  ipAddress: inet('ip_address').notNull(),
  userAgent: text('user_agent'),
  country: varchar('country', { length: 2 }), // ISO country code from GeoIP
  city: varchar('city', { length: 100 }),
  
  // Request context
  referer: text('referer'),
  requestId: varchar('request_id', { length: 64 }),
  
  // Timing
  accessedAt: timestamp('accessed_at', { withTimezone: true }).defaultNow().notNull(),
  duration: integer('duration'), // Request duration in ms
}, (table) => [
  index('idx_access_log_share').on(table.shareId),
  index('idx_access_log_document').on(table.documentId),
  index('idx_access_log_time').on(table.accessedAt),
  index('idx_access_log_ip').on(table.ipAddress),
]);

// ============================================
// Document Versions
// ============================================

/**
 * Document version history for tracking changes.
 */
export const documentVersions = pgTable('document_versions', {
  id: serial('id').primaryKey(),
  
  // Document reference
  documentId: integer('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  
  // Version info
  versionNumber: integer('version_number').notNull(),
  isLatest: boolean('is_latest').default(true).notNull(),
  
  // File details (at time of version)
  filename: varchar('filename', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  checksum: varchar('checksum', { length: 64 }), // SHA-256 hash
  
  // Change metadata
  changeNote: text('change_note'),
  changeType: varchar('change_type', { length: 50 }), // 'upload', 'replace', 'metadata_update'
  
  // Audit
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_versions_document').on(table.documentId),
  index('idx_versions_latest').on(table.isLatest),
]);

// ============================================
// Bulk Share Operations
// ============================================

/**
 * Tracks bulk share operations for multiple documents.
 */
export const bulkShareOperations = pgTable('bulk_share_operations', {
  id: serial('id').primaryKey(),
  
  // Operation identifier
  operationId: uuid('operation_id').defaultRandom().unique().notNull(),
  
  // Configuration (shared across all documents)
  permission: sharePermissionEnum('permission').notNull().default('view'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  passwordHash: varchar('password_hash', { length: 255 }),
  message: text('message'),
  
  // Recipients
  recipientEmails: jsonb('recipient_emails').$type<string[]>(),
  clientIds: jsonb('client_ids').$type<number[]>(),
  
  // Status
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  totalDocuments: integer('total_documents').notNull(),
  processedDocuments: integer('processed_documents').default(0).notNull(),
  failedDocuments: integer('failed_documents').default(0).notNull(),
  
  // Result
  shareIds: jsonb('share_ids').$type<number[]>(),
  errors: jsonb('errors').$type<Array<{ documentId: number; error: string }>>(),
  
  // Audit
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ============================================
// Types
// ============================================

export type DocumentShare = InferSelectModel<typeof documentShares>;
export type CreateDocumentShare = InferInsertModel<typeof documentShares>;
export type UpdateDocumentShare = Partial<Omit<CreateDocumentShare, 'id' | 'shareToken' | 'createdBy' | 'createdAt'>>;

export type ShareAccessLog = InferSelectModel<typeof shareAccessLogs>;
export type CreateShareAccessLog = InferInsertModel<typeof shareAccessLogs>;

export type DocumentVersion = InferSelectModel<typeof documentVersions>;
export type CreateDocumentVersion = InferInsertModel<typeof documentVersions>;

export type BulkShareOperation = InferSelectModel<typeof bulkShareOperations>;
export type CreateBulkShareOperation = InferInsertModel<typeof bulkShareOperations>;
