/**
 * @fileoverview Documents repository with type-safe filtering.
 */

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db } from '../database/connection'
import { documents, type Document } from '../database/schema'
import type { DocumentFilters } from '../validation/schemas'

/**
 * Repository for document/file CRUD operations.
 */
export class DocumentsRepository extends CRUDRepository<Document, DocumentFilters> {
  protected override readonly table = documents
  protected override readonly db = db
  protected override readonly hasSoftDelete = true

  /**
   * Build WHERE clause for document-specific filters.
   */
  protected override buildWhereClause(filters: DocumentFilters): SQL | undefined {
    const conditions: SQL[] = []

    // Category filter (exact match)
    if (filters.category) {
      conditions.push(eq(documents.category, filters.category))
    }

    // Property filter (exact match)
    if (filters.propertyId !== undefined) {
      conditions.push(eq(documents.propertyId, filters.propertyId))
    }

    // Client filter (exact match)
    if (filters.clientId !== undefined) {
      conditions.push(eq(documents.clientId, filters.clientId))
    }

    // Uploader filter (exact match)
    if (filters.uploadedBy !== undefined) {
      conditions.push(eq(documents.uploadedBy, filters.uploadedBy))
    }

    // Public flag filter
    if (filters.isPublic !== undefined) {
      conditions.push(eq(documents.isPublic, filters.isPublic))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * Find a document by its access token.
   */
  async findByAccessToken(token: string): Promise<Document | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(documents.accessToken, token),
        isNull(documents.deletedAt)
      ))
      .limit(1)
    
    return results[0] ?? null
  }

  /**
   * Increment the download count for a document.
   */
  async incrementDownloadCount(id: number): Promise<void> {
    await this.db
      .update(documents)
      .set({ 
        downloadCount: sql`${documents.downloadCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
  }

  /**
   * Find all documents for a property.
   */
  async findByProperty(propertyId: number): Promise<Document[]> {
    return this.findMany({ propertyId } as DocumentFilters, { limit: 100 })
  }

  /**
   * Find all documents for a client.
   */
  async findByClient(clientId: number): Promise<Document[]> {
    return this.findMany({ clientId } as DocumentFilters, { limit: 100 })
  }

  /**
   * Find public documents only.
   */
  async findPublic(): Promise<Document[]> {
    return this.findMany({ isPublic: true } as DocumentFilters, { limit: 100 })
  }
}

/** Singleton repository instance */
export const documentsRepository = new DocumentsRepository()
