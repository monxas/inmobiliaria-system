import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db, type Database } from '../database/connection'
import { documents, type Document } from '../database/schema'
import type { DocumentFilters } from '../validation/schemas'

export class DocumentsRepository extends CRUDRepository<Document> {
  table = documents
  db: Database = db

  protected buildWhereClause(filters: DocumentFilters): SQL | undefined {
    const conditions: SQL[] = []

    if (filters.category) {
      conditions.push(eq(documents.category, filters.category))
    }

    if (filters.propertyId) {
      conditions.push(eq(documents.propertyId, filters.propertyId))
    }

    if (filters.clientId) {
      conditions.push(eq(documents.clientId, filters.clientId))
    }

    if (filters.uploadedBy) {
      conditions.push(eq(documents.uploadedBy, filters.uploadedBy))
    }

    if (filters.isPublic !== undefined) {
      conditions.push(eq(documents.isPublic, filters.isPublic))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  protected get hasSoftDelete(): boolean {
    return true
  }

  async findByAccessToken(token: string): Promise<Document | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(documents.accessToken, token),
        isNull(documents.deletedAt)
      ))
      .limit(1)
    return result[0] || null
  }

  async incrementDownloadCount(id: number): Promise<void> {
    await this.db
      .update(documents)
      .set({ downloadCount: sql`download_count + 1`, updatedAt: new Date() } as any)
      .where(eq(documents.id, id))
  }
}

export const documentsRepository = new DocumentsRepository()
