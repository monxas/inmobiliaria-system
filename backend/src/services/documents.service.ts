/**
 * @fileoverview Documents service with file management logic.
 */

import { CRUDService } from './base/crud.service'
import { documentsRepository } from '../repositories/documents.repository'
import type { Document } from '../database/schema'
import type { CreateDocumentInput, UpdateDocumentInput, DocumentFilters } from '../validation/schemas'
import { NotFoundError, ForbiddenError } from '../types/errors'
import { generateSecureToken } from '../utils/crypto'
import { logger } from '../lib/logger'

/**
 * Service for document/file business logic.
 */
export class DocumentsService extends CRUDService<
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentFilters
> {
  protected override repository = documentsRepository

  protected override get resourceName(): string {
    return 'Document'
  }

  /**
   * Process create input.
   * Generates access token if not provided.
   */
  protected override async processCreateInput(input: CreateDocumentInput): Promise<CreateDocumentInput> {
    return {
      ...input,
      accessToken: input.accessToken ?? generateSecureToken(32),
    }
  }

  /**
   * Find document by its access token.
   */
  async findByAccessToken(token: string): Promise<Document | null> {
    return this.repository.findByAccessToken(token)
  }

  /**
   * Download a document using access token.
   * Validates expiry and increments download count.
   * 
   * @throws NotFoundError if document not found
   * @throws ForbiddenError if document link is expired
   */
  async downloadDocument(token: string): Promise<Document> {
    const doc = await this.repository.findByAccessToken(token)
    
    if (!doc) {
      throw new NotFoundError('Document')
    }

    // Check if expired
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      logger.warn('Expired document access attempted', { 
        documentId: doc.id, 
        expiredAt: doc.expiresAt 
      })
      throw new ForbiddenError('This document link has expired')
    }

    // Increment download count
    await this.repository.incrementDownloadCount(doc.id)

    logger.debug('Document downloaded', { documentId: doc.id })

    return doc
  }

  /**
   * Generate a new access token for a document.
   * 
   * @throws NotFoundError if document not found
   */
  async regenerateAccessToken(id: number): Promise<Document> {
    await this.findByIdOrFail(id)
    
    const newToken = generateSecureToken(32)
    const updated = await this.repository.update(id, { accessToken: newToken })

    logger.info('Document access token regenerated', { documentId: id })

    return updated
  }

  /**
   * Set or clear document expiry date.
   * 
   * @throws NotFoundError if document not found
   */
  async setExpiry(id: number, expiresAt: Date | string | null): Promise<Document> {
    await this.findByIdOrFail(id)
    
    const expiry = expiresAt 
      ? (typeof expiresAt === 'string' ? expiresAt : expiresAt.toISOString())
      : null

    const updated = await this.repository.update(id, { 
      expiresAt: expiry 
    } as Partial<CreateDocumentInput>)

    logger.info('Document expiry updated', { documentId: id, expiresAt: expiry })

    return updated
  }

  /**
   * Toggle document public visibility.
   * 
   * @throws NotFoundError if document not found
   */
  async setPublic(id: number, isPublic: boolean): Promise<Document> {
    await this.findByIdOrFail(id)
    
    const updated = await this.repository.update(id, { isPublic })

    logger.info('Document visibility updated', { documentId: id, isPublic })

    return updated
  }

  /**
   * Get all documents for a property.
   */
  async findByProperty(propertyId: number): Promise<Document[]> {
    return this.repository.findByProperty(propertyId)
  }

  /**
   * Get all documents for a client.
   */
  async findByClient(clientId: number): Promise<Document[]> {
    return this.repository.findByClient(clientId)
  }
}

export const documentsService = new DocumentsService()
