/**
 * @fileoverview Document shares repository with type-safe operations.
 */

import { and, eq, isNull, sql, gte, lte, desc, asc, type SQL, inArray } from 'drizzle-orm'
import { db } from '../database/connection'
import { 
  documentShares, 
  shareAccessLogs, 
  documentVersions,
  bulkShareOperations,
  type DocumentShare, 
  type CreateDocumentShare,
  type ShareAccessLog,
  type CreateShareAccessLog,
  type DocumentVersion,
  type CreateDocumentVersion,
  type BulkShareOperation,
  type CreateBulkShareOperation,
} from '../database/schema'
import type { ShareFilters, AccessLogFilters } from '../validation/document-shares.schema'

/**
 * Repository for document share operations.
 */
export class DocumentSharesRepository {
  protected readonly db = db

  // ============================================
  // Share CRUD
  // ============================================

  async createShare(data: CreateDocumentShare): Promise<DocumentShare> {
    const [result] = await this.db
      .insert(documentShares)
      .values(data)
      .returning()
    return result!
  }

  async findShareById(id: number): Promise<DocumentShare | null> {
    const [result] = await this.db
      .select()
      .from(documentShares)
      .where(eq(documentShares.id, id))
      .limit(1)
    return result ?? null
  }

  async findShareByToken(token: string): Promise<DocumentShare | null> {
    const [result] = await this.db
      .select()
      .from(documentShares)
      .where(eq(documentShares.shareToken, token))
      .limit(1)
    return result ?? null
  }

  async findShareByShortCode(shortCode: string): Promise<DocumentShare | null> {
    const [result] = await this.db
      .select()
      .from(documentShares)
      .where(eq(documentShares.shortCode, shortCode))
      .limit(1)
    return result ?? null
  }

  async updateShare(id: number, data: Partial<CreateDocumentShare>): Promise<DocumentShare> {
    const [result] = await this.db
      .update(documentShares)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentShares.id, id))
      .returning()
    return result!
  }

  async deleteShare(id: number): Promise<void> {
    await this.db
      .delete(documentShares)
      .where(eq(documentShares.id, id))
  }

  async findShares(
    filters: ShareFilters,
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<{ data: DocumentShare[]; total: number }> {
    const conditions: SQL[] = []

    if (filters.documentId) {
      conditions.push(eq(documentShares.documentId, filters.documentId))
    }
    if (filters.shareType) {
      conditions.push(eq(documentShares.shareType, filters.shareType))
    }
    if (filters.permission) {
      conditions.push(eq(documentShares.permission, filters.permission))
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(documentShares.isActive, filters.isActive))
    }
    if (filters.isRevoked !== undefined) {
      conditions.push(eq(documentShares.isRevoked, filters.isRevoked))
    }
    if (filters.clientId) {
      conditions.push(eq(documentShares.clientId, filters.clientId))
    }
    if (filters.recipientEmail) {
      conditions.push(eq(documentShares.recipientEmail, filters.recipientEmail))
    }
    if (filters.createdBy) {
      conditions.push(eq(documentShares.createdBy, filters.createdBy))
    }
    if (filters.expiresBefore) {
      conditions.push(lte(documentShares.expiresAt, new Date(filters.expiresBefore)))
    }
    if (filters.expiresAfter) {
      conditions.push(gte(documentShares.expiresAt, new Date(filters.expiresAfter)))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentShares)
      .where(whereClause)

    const data = await this.db
      .select()
      .from(documentShares)
      .where(whereClause)
      .orderBy(desc(documentShares.createdAt))
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit)

    return { data, total: countResult?.count ?? 0 }
  }

  async findSharesByDocument(documentId: number): Promise<DocumentShare[]> {
    return this.db
      .select()
      .from(documentShares)
      .where(and(
        eq(documentShares.documentId, documentId),
        eq(documentShares.isActive, true),
        eq(documentShares.isRevoked, false)
      ))
      .orderBy(desc(documentShares.createdAt))
  }

  async incrementViewCount(id: number): Promise<void> {
    await this.db
      .update(documentShares)
      .set({ 
        currentViews: sql`${documentShares.currentViews} + 1`,
        updatedAt: new Date()
      })
      .where(eq(documentShares.id, id))
  }

  async incrementDownloadCount(id: number): Promise<void> {
    await this.db
      .update(documentShares)
      .set({ 
        currentDownloads: sql`${documentShares.currentDownloads} + 1`,
        updatedAt: new Date()
      })
      .where(eq(documentShares.id, id))
  }

  async revokeShare(
    id: number, 
    revokedBy: number, 
    reason?: string
  ): Promise<DocumentShare> {
    const [result] = await this.db
      .update(documentShares)
      .set({
        isActive: false,
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy,
        revokeReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(documentShares.id, id))
      .returning()
    return result!
  }

  async bulkRevokeByDocument(documentId: number, revokedBy: number): Promise<number> {
    const result = await this.db
      .update(documentShares)
      .set({
        isActive: false,
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy,
        revokeReason: 'Document deleted or access revoked',
        updatedAt: new Date(),
      })
      .where(and(
        eq(documentShares.documentId, documentId),
        eq(documentShares.isActive, true)
      ))
    return result.rowCount ?? 0
  }

  // ============================================
  // Access Logs
  // ============================================

  async createAccessLog(data: CreateShareAccessLog): Promise<ShareAccessLog> {
    const [result] = await this.db
      .insert(shareAccessLogs)
      .values(data)
      .returning()
    return result!
  }

  async findAccessLogs(
    filters: AccessLogFilters,
    pagination: { page: number; limit: number } = { page: 1, limit: 50 }
  ): Promise<{ data: ShareAccessLog[]; total: number }> {
    const conditions: SQL[] = []

    if (filters.shareId) {
      conditions.push(eq(shareAccessLogs.shareId, filters.shareId))
    }
    if (filters.documentId) {
      conditions.push(eq(shareAccessLogs.documentId, filters.documentId))
    }
    if (filters.action) {
      conditions.push(eq(shareAccessLogs.action, filters.action))
    }
    if (filters.success !== undefined) {
      conditions.push(eq(shareAccessLogs.success, filters.success))
    }
    if (filters.accessedBy) {
      conditions.push(eq(shareAccessLogs.accessedBy, filters.accessedBy))
    }
    if (filters.ipAddress) {
      conditions.push(eq(shareAccessLogs.ipAddress, filters.ipAddress))
    }
    if (filters.startDate) {
      conditions.push(gte(shareAccessLogs.accessedAt, new Date(filters.startDate)))
    }
    if (filters.endDate) {
      conditions.push(lte(shareAccessLogs.accessedAt, new Date(filters.endDate)))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(shareAccessLogs)
      .where(whereClause)

    const data = await this.db
      .select()
      .from(shareAccessLogs)
      .where(whereClause)
      .orderBy(desc(shareAccessLogs.accessedAt))
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit)

    return { data, total: countResult?.count ?? 0 }
  }

  async getAccessStats(shareId: number): Promise<{
    totalViews: number;
    totalDownloads: number;
    uniqueIps: number;
    lastAccess: Date | null;
  }> {
    const [stats] = await this.db
      .select({
        totalViews: sql<number>`count(case when action = 'view' then 1 end)::int`,
        totalDownloads: sql<number>`count(case when action = 'download' then 1 end)::int`,
        uniqueIps: sql<number>`count(distinct ip_address)::int`,
        lastAccess: sql<Date | null>`max(accessed_at)`,
      })
      .from(shareAccessLogs)
      .where(eq(shareAccessLogs.shareId, shareId))

    return stats ?? { totalViews: 0, totalDownloads: 0, uniqueIps: 0, lastAccess: null }
  }

  // ============================================
  // Document Versions
  // ============================================

  async createVersion(data: CreateDocumentVersion): Promise<DocumentVersion> {
    // First, mark all existing versions as not latest
    await this.db
      .update(documentVersions)
      .set({ isLatest: false })
      .where(eq(documentVersions.documentId, data.documentId))

    const [result] = await this.db
      .insert(documentVersions)
      .values({ ...data, isLatest: true })
      .returning()
    return result!
  }

  async findVersionsByDocument(documentId: number): Promise<DocumentVersion[]> {
    return this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.versionNumber))
  }

  async findLatestVersion(documentId: number): Promise<DocumentVersion | null> {
    const [result] = await this.db
      .select()
      .from(documentVersions)
      .where(and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.isLatest, true)
      ))
      .limit(1)
    return result ?? null
  }

  async findVersionById(id: number): Promise<DocumentVersion | null> {
    const [result] = await this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, id))
      .limit(1)
    return result ?? null
  }

  async getNextVersionNumber(documentId: number): Promise<number> {
    const [result] = await this.db
      .select({ maxVersion: sql<number>`coalesce(max(version_number), 0)::int` })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
    return (result?.maxVersion ?? 0) + 1
  }

  // ============================================
  // Bulk Operations
  // ============================================

  async createBulkOperation(data: CreateBulkShareOperation): Promise<BulkShareOperation> {
    const [result] = await this.db
      .insert(bulkShareOperations)
      .values(data)
      .returning()
    return result!
  }

  async updateBulkOperation(
    id: number, 
    data: Partial<CreateBulkShareOperation>
  ): Promise<BulkShareOperation> {
    const [result] = await this.db
      .update(bulkShareOperations)
      .set(data)
      .where(eq(bulkShareOperations.id, id))
      .returning()
    return result!
  }

  async findBulkOperationById(id: number): Promise<BulkShareOperation | null> {
    const [result] = await this.db
      .select()
      .from(bulkShareOperations)
      .where(eq(bulkShareOperations.id, id))
      .limit(1)
    return result ?? null
  }

  // ============================================
  // Cleanup
  // ============================================

  async findExpiredShares(): Promise<DocumentShare[]> {
    return this.db
      .select()
      .from(documentShares)
      .where(and(
        eq(documentShares.isActive, true),
        lte(documentShares.expiresAt, new Date())
      ))
  }

  async deactivateExpiredShares(): Promise<number> {
    const result = await this.db
      .update(documentShares)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(documentShares.isActive, true),
        lte(documentShares.expiresAt, new Date())
      ))
    return result.rowCount ?? 0
  }
}

/** Singleton repository instance */
export const documentSharesRepository = new DocumentSharesRepository()
