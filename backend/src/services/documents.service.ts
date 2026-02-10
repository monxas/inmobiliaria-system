import { CRUDService } from './base/crud.service'
import { documentsRepository, type DocumentsRepository } from '../repositories/documents.repository'
import type { Document } from '../database/schema'
import type { CreateDocumentInput, UpdateDocumentInput, DocumentFilters } from '../validation/schemas'
import { NotFoundError, ForbiddenError } from '../types/errors'
import { generateSecureToken } from '../utils/crypto'

export class DocumentsService extends CRUDService<
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentFilters
> {
  repository: DocumentsRepository = documentsRepository

  protected async processCreateInput(input: CreateDocumentInput): Promise<any> {
    // Generate access token if not provided
    if (!input.accessToken) {
      input.accessToken = generateSecureToken(32)
    }
    return input
  }

  async findByAccessToken(token: string): Promise<Document | null> {
    return this.repository.findByAccessToken(token)
  }

  async downloadDocument(token: string): Promise<Document> {
    const doc = await this.repository.findByAccessToken(token)
    if (!doc) {
      throw new NotFoundError('Document')
    }

    // Check if expired
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      throw new ForbiddenError('This document link has expired')
    }

    // Increment download count
    await this.repository.incrementDownloadCount(doc.id)

    return doc
  }

  async regenerateAccessToken(id: number): Promise<Document> {
    const doc = await this.repository.findById(id)
    if (!doc) {
      throw new NotFoundError('Document')
    }

    return this.repository.update(id, {
      accessToken: generateSecureToken(32),
    } as any)
  }

  async setExpiry(id: number, expiresAt: Date | null): Promise<Document> {
    const doc = await this.repository.findById(id)
    if (!doc) {
      throw new NotFoundError('Document')
    }

    return this.repository.update(id, {
      expiresAt,
    } as any)
  }
}

export const documentsService = new DocumentsService()
