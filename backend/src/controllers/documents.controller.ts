import type { Context } from 'hono'
import { CRUDController } from './base/crud.controller'
import { documentsService, type DocumentsService } from '../services/documents.service'
import type { Document } from '../database/schema'
import { 
  CreateDocumentSchema, 
  UpdateDocumentSchema,
  type CreateDocumentInput, 
  type UpdateDocumentInput, 
  type DocumentFilters 
} from '../validation/schemas'
import { ValidationError } from '../types/errors'
import { apiResponse, apiError } from '../utils/response'
import type { AppVariables } from '../types'
import * as fs from 'fs'
import * as path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads'

export class DocumentsController extends CRUDController<
  Document,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentFilters
> {
  service: DocumentsService = documentsService

  protected validateCreateInput(input: any): CreateDocumentInput {
    const result = CreateDocumentSchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  protected validateUpdateInput(input: any): UpdateDocumentInput {
    const result = UpdateDocumentSchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  protected parseFilters(query: Record<string, string>): DocumentFilters {
    return {
      category: query.category as any || undefined,
      propertyId: query.propertyId ? Number(query.propertyId) : undefined,
      clientId: query.clientId ? Number(query.clientId) : undefined,
      uploadedBy: query.uploadedBy ? Number(query.uploadedBy) : undefined,
      isPublic: query.isPublic === 'true' ? true : query.isPublic === 'false' ? false : undefined,
    }
  }

  // POST /documents/upload - Handle file upload
  async upload(c: Context<{ Variables: AppVariables }>) {
    try {
      const user = c.get('user')
      if (!user) {
        return c.json(apiError('Authentication required', 401), 401)
      }

      const formData = await c.req.formData()
      const file = formData.get('file') as File | null
      
      if (!file) {
        return c.json(apiError('No file provided', 400), 400)
      }

      // Generate unique filename
      const ext = path.extname(file.name)
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      const category = (formData.get('category') as string) || 'other'
      const filePath = path.join(UPLOAD_DIR, category, uniqueName)

      // Ensure directory exists
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write file
      const arrayBuffer = await file.arrayBuffer()
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer))

      // Create document record
      const docInput: CreateDocumentInput = {
        filename: uniqueName,
        originalFilename: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        category: category as any,
        propertyId: formData.get('propertyId') ? Number(formData.get('propertyId')) : null,
        clientId: formData.get('clientId') ? Number(formData.get('clientId')) : null,
        isPublic: formData.get('isPublic') === 'true',
        uploadedBy: user.id,
      }

      const doc = await this.service.create(docInput)
      return c.json(apiResponse(doc), 201)
    } catch (error) {
      return this.handleError(c, error, 'Failed to upload document')
    }
  }

  // GET /documents/download/:token
  async download(c: Context) {
    try {
      const token = c.req.param('token')
      if (!token) {
        return c.json(apiError('Access token required', 400), 400)
      }

      const doc = await this.service.downloadDocument(token)
      
      // Check if file exists
      if (!fs.existsSync(doc.filePath)) {
        return c.json(apiError('File not found on disk', 404), 404)
      }

      const fileBuffer = fs.readFileSync(doc.filePath)
      
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': doc.mimeType,
          'Content-Disposition': `attachment; filename="${doc.originalFilename}"`,
          'Content-Length': String(doc.fileSize),
        },
      })
    } catch (error) {
      return this.handleError(c, error, 'Failed to download document')
    }
  }

  // POST /documents/:id/regenerate-token
  async regenerateToken(c: Context) {
    try {
      const id = Number(c.req.param('id'))
      if (!id) return c.json(apiError('Invalid ID', 400), 400)

      const doc = await this.service.regenerateAccessToken(id)
      return c.json(apiResponse(doc))
    } catch (error) {
      return this.handleError(c, error, 'Failed to regenerate token')
    }
  }
}

export const documentsController = new DocumentsController()
