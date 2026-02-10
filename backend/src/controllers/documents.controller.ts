/**
 * @fileoverview Documents controller with type-safe validation.
 */

import type { Context } from 'hono'
import { CRUDController } from './base/crud.controller'
import { documentsService } from '../services/documents.service'
import type { Document } from '../database/schema'
import { 
  CreateDocumentSchema, 
  UpdateDocumentSchema,
  DocumentFiltersSchema,
  type CreateDocumentInput, 
  type UpdateDocumentInput, 
  type DocumentFilters 
} from '../validation/schemas'
import { apiError, apiResponse } from '../utils/response'

/**
 * Controller for document CRUD operations.
 */
export class DocumentsController extends CRUDController<
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentFilters
> {
  protected override readonly service = documentsService
  protected override readonly createSchema = CreateDocumentSchema
  protected override readonly updateSchema = UpdateDocumentSchema
  protected override readonly filtersSchema = DocumentFiltersSchema

  protected override get resourceName(): string {
    return 'Document'
  }

  /**
   * Download document by access token
   */
  async download(c: Context): Promise<Response> {
    const token = c.req.param('token')
    if (!token) {
      return c.json(apiError('Access token required', 400), 400)
    }
    
    const document = await documentsService.findByAccessToken(token)
    if (!document) {
      return c.json(apiError('Document not found or access denied', 404), 404)
    }

    // In production, would stream the actual file
    return c.json(apiResponse({ 
      filename: document.originalFilename,
      filePath: document.filePath,
      mimeType: document.mimeType 
    }))
  }

  /**
   * Handle file upload
   */
  async upload(c: Context): Promise<Response> {
    // In production, would handle multipart form data
    return c.json(apiError('File upload not implemented', 501), 501)
  }

  /**
   * Regenerate access token for a document
   */
  async regenerateToken(c: Context): Promise<Response> {
    const id = Number(c.req.param('id'))
    if (!id) {
      return c.json(apiError('Invalid document ID', 400), 400)
    }

    const document = await documentsService.regenerateAccessToken(id)
    if (!document) {
      return c.json(apiError('Document not found', 404), 404)
    }

    return c.json(apiResponse(document))
  }
}

/** Singleton controller instance */
export const documentsController = new DocumentsController()
