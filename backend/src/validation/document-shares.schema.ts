/**
 * @fileoverview Zod validation schemas for document sharing.
 */

import { z } from 'zod'

// ============================================
// Enums
// ============================================

export const SharePermissionEnum = z.enum(['view', 'download', 'edit'])
export type SharePermission = z.infer<typeof SharePermissionEnum>

export const ShareTypeEnum = z.enum(['link', 'email', 'client'])
export type ShareType = z.infer<typeof ShareTypeEnum>

// ============================================
// Create Share Schema
// ============================================

export const CreateShareSchema = z.object({
  documentId: z.number().int().positive(),
  
  // Share configuration
  shareType: ShareTypeEnum.default('link'),
  permission: SharePermissionEnum.default('view'),
  
  // Security options
  password: z.string().min(4).max(100).optional(),
  maxDownloads: z.number().int().positive().max(10000).optional(),
  maxViews: z.number().int().positive().max(100000).optional(),
  
  // Time constraints
  expiresAt: z.string().datetime().optional(),
  expiresInHours: z.number().int().positive().max(8760).optional(), // Max 1 year
  activatesAt: z.string().datetime().optional(),
  
  // Email sharing
  recipientEmail: z.string().email().max(255).optional(),
  recipientName: z.string().max(255).optional(),
  clientId: z.number().int().positive().optional(),
  
  // Notifications
  notifyOnAccess: z.boolean().default(false),
  notifyEmail: z.string().email().max(255).optional(),
  
  // Custom message
  message: z.string().max(2000).optional(),
}).refine((data) => {
  // If shareType is 'email', recipientEmail is required
  if (data.shareType === 'email' && !data.recipientEmail) {
    return false
  }
  return true
}, {
  message: 'Recipient email is required for email shares',
  path: ['recipientEmail'],
}).refine((data) => {
  // If shareType is 'client', clientId is required
  if (data.shareType === 'client' && !data.clientId) {
    return false
  }
  return true
}, {
  message: 'Client ID is required for client shares',
  path: ['clientId'],
})

export type CreateShareInput = z.infer<typeof CreateShareSchema>

// ============================================
// Update Share Schema
// ============================================

export const UpdateShareSchema = z.object({
  permission: SharePermissionEnum.optional(),
  password: z.string().min(4).max(100).optional().nullable(), // Null to remove password
  maxDownloads: z.number().int().positive().max(10000).optional().nullable(),
  maxViews: z.number().int().positive().max(100000).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  notifyOnAccess: z.boolean().optional(),
  notifyEmail: z.string().email().max(255).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
})

export type UpdateShareInput = z.infer<typeof UpdateShareSchema>

// ============================================
// Bulk Share Schema
// ============================================

export const BulkShareSchema = z.object({
  documentIds: z.array(z.number().int().positive()).min(1).max(100),
  
  // Shared configuration for all documents
  permission: SharePermissionEnum.default('view'),
  password: z.string().min(4).max(100).optional(),
  expiresInHours: z.number().int().positive().max(8760).optional(),
  maxDownloads: z.number().int().positive().max(10000).optional(),
  
  // Recipients (at least one required)
  recipientEmails: z.array(z.string().email()).max(50).optional(),
  clientIds: z.array(z.number().int().positive()).max(50).optional(),
  
  // Message
  message: z.string().max(2000).optional(),
}).refine((data) => {
  // At least one recipient type must be provided
  const hasEmails = data.recipientEmails && data.recipientEmails.length > 0
  const hasClients = data.clientIds && data.clientIds.length > 0
  return hasEmails || hasClients || true // Allow share links without recipients
}, {
  message: 'At least one recipient (email or client) must be specified for email/client shares',
})

export type BulkShareInput = z.infer<typeof BulkShareSchema>

// ============================================
// Access Share Schema (for validating access requests)
// ============================================

export const AccessShareSchema = z.object({
  password: z.string().max(100).optional(),
})

export type AccessShareInput = z.infer<typeof AccessShareSchema>

// ============================================
// Revoke Share Schema
// ============================================

export const RevokeShareSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type RevokeShareInput = z.infer<typeof RevokeShareSchema>

// ============================================
// Share Filters Schema
// ============================================

export const ShareFiltersSchema = z.object({
  documentId: z.coerce.number().int().positive().optional(),
  shareType: ShareTypeEnum.optional(),
  permission: SharePermissionEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  isRevoked: z.coerce.boolean().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  recipientEmail: z.string().max(255).optional(),
  createdBy: z.coerce.number().int().positive().optional(),
  expiresBefore: z.string().datetime().optional(),
  expiresAfter: z.string().datetime().optional(),
})

export type ShareFilters = z.infer<typeof ShareFiltersSchema>

// ============================================
// Access Log Filters Schema
// ============================================

export const AccessLogFiltersSchema = z.object({
  shareId: z.coerce.number().int().positive().optional(),
  documentId: z.coerce.number().int().positive().optional(),
  action: z.enum(['view', 'download', 'preview', 'share', 'revoke']).optional(),
  success: z.coerce.boolean().optional(),
  accessedBy: z.coerce.number().int().positive().optional(),
  ipAddress: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type AccessLogFilters = z.infer<typeof AccessLogFiltersSchema>

// ============================================
// Document Version Schema
// ============================================

export const CreateVersionSchema = z.object({
  documentId: z.number().int().positive(),
  filename: z.string().min(1).max(255),
  filePath: z.string().min(1).max(1000),
  fileSize: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
  mimeType: z.string().min(1).max(100),
  checksum: z.string().max(64).optional(),
  changeNote: z.string().max(500).optional(),
  changeType: z.enum(['upload', 'replace', 'metadata_update']).default('upload'),
})

export type CreateVersionInput = z.infer<typeof CreateVersionSchema>
