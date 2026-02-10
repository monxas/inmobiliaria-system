import { describe, test, expect, beforeEach } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errors'
import { validateBody, validateQuery } from '../../src/middleware/validation'
import { generateSecureToken } from '../../src/utils/crypto'
import { apiResponse, apiError } from '../../src/utils/response'
import { appRequest, parseResponse, generateTestToken } from '../helpers'
import { resetFactoryCounter } from '../factories'
import type { AppVariables } from '../../src/types'

/**
 * Documents API Integration Tests
 * Simulates document CRUD, upload, and token-based download
 */

const createDocumentSchema = z.object({
  filename: z.string().min(1),
  originalFilename: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
  category: z.enum(['property_docs', 'property_images', 'client_docs', 'contracts', 'other']).default('other'),
  propertyId: z.number().optional(),
  clientId: z.number().optional(),
  isPublic: z.boolean().default(false),
  uploadedBy: z.number(),
})

const updateDocumentSchema = z.object({
  category: z.enum(['property_docs', 'property_images', 'client_docs', 'contracts', 'other']).optional(),
  isPublic: z.boolean().optional(),
})

const filterQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
  category: z.enum(['property_docs', 'property_images', 'client_docs', 'contracts', 'other']).optional(),
  propertyId: z.string().optional(),
  clientId: z.string().optional(),
  isPublic: z.string().optional(),
})

interface MemDocument {
  id: number
  filename: string
  originalFilename: string
  filePath: string
  fileSize: number
  mimeType: string
  category: string
  propertyId?: number
  clientId?: number
  accessToken: string
  expiresAt?: Date
  downloadCount: number
  isPublic: boolean
  uploadedBy: number
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

function createDocumentsApp() {
  const documents: MemDocument[] = []
  let nextId = 1

  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', errorHandler())

  // Public download route (uses access token)
  app.get('/documents/download/:token', async (c) => {
    const token = c.req.param('token')
    const doc = documents.find(d => d.accessToken === token && !d.deletedAt)
    
    if (!doc) return c.json(apiError('Document not found', 404), 404)
    
    // Check expiry
    if (doc.expiresAt && doc.expiresAt < new Date()) {
      return c.json(apiError('Link expired', 403), 403)
    }
    
    doc.downloadCount++
    
    // In real implementation, would stream the file
    return c.json(apiResponse({
      filename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      downloadCount: doc.downloadCount,
    }))
  })

  // All other routes require auth
  app.use('/documents/*', requireAuth())

  // List documents
  app.get('/documents', requireRole(['admin', 'agent']), validateQuery(filterQuerySchema), async (c) => {
    const { page, limit, category, propertyId, clientId, isPublic } = c.get('validatedQuery')
    
    let filtered = documents.filter(d => !d.deletedAt)
    
    if (category) filtered = filtered.filter(d => d.category === category)
    if (propertyId) filtered = filtered.filter(d => d.propertyId === parseInt(propertyId))
    if (clientId) filtered = filtered.filter(d => d.clientId === parseInt(clientId))
    if (isPublic !== undefined) filtered = filtered.filter(d => d.isPublic === (isPublic === 'true'))
    
    const pageNum = parseInt(page)
    const limitNum = Math.min(parseInt(limit), 100)
    const start = (pageNum - 1) * limitNum
    const paged = filtered.slice(start, start + limitNum)
    
    return c.json(apiResponse(paged, {
      pagination: { page: pageNum, limit: limitNum, total: filtered.length, pages: Math.ceil(filtered.length / limitNum) }
    }))
  })

  // Get by ID
  app.get('/documents/:id', requireRole(['admin', 'agent']), async (c) => {
    const id = parseInt(c.req.param('id'))
    const doc = documents.find(d => d.id === id && !d.deletedAt)
    if (!doc) return c.json(apiError('Document not found', 404), 404)
    return c.json(apiResponse(doc))
  })

  // Create (simulates upload metadata)
  app.post('/documents', requireRole(['admin', 'agent']), validateBody(createDocumentSchema), async (c) => {
    const data = c.get('validatedBody')
    
    const doc: MemDocument = {
      id: nextId++,
      ...data,
      accessToken: generateSecureToken(32),
      downloadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    documents.push(doc)
    
    return c.json(apiResponse(doc), 201)
  })

  // Update
  app.put('/documents/:id', requireRole(['admin', 'agent']), validateBody(updateDocumentSchema), async (c) => {
    const id = parseInt(c.req.param('id'))
    const doc = documents.find(d => d.id === id && !d.deletedAt)
    if (!doc) return c.json(apiError('Document not found', 404), 404)
    
    const updates = c.get('validatedBody')
    Object.assign(doc, updates, { updatedAt: new Date() })
    
    return c.json(apiResponse(doc))
  })

  // Delete
  app.delete('/documents/:id', requireRole(['admin', 'agent']), async (c) => {
    const id = parseInt(c.req.param('id'))
    const doc = documents.find(d => d.id === id && !d.deletedAt)
    if (!doc) return c.json(apiError('Document not found', 404), 404)
    
    doc.deletedAt = new Date()
    return c.json(apiResponse({ id, deleted: true }))
  })

  // Regenerate access token
  app.post('/documents/:id/regenerate-token', requireRole(['admin', 'agent']), async (c) => {
    const id = parseInt(c.req.param('id'))
    const doc = documents.find(d => d.id === id && !d.deletedAt)
    if (!doc) return c.json(apiError('Document not found', 404), 404)
    
    doc.accessToken = generateSecureToken(32)
    doc.updatedAt = new Date()
    
    return c.json(apiResponse(doc))
  })

  return { app, documents }
}

describe('Documents API', () => {
  let app: ReturnType<typeof createDocumentsApp>['app']
  let documents: ReturnType<typeof createDocumentsApp>['documents']
  let agentToken: string
  let clientToken: string
  let adminToken: string

  beforeEach(() => {
    resetFactoryCounter()
    const result = createDocumentsApp()
    app = result.app
    documents = result.documents
    
    agentToken = generateTestToken({ userId: 1, role: 'agent' })
    clientToken = generateTestToken({ userId: 2, role: 'client' })
    adminToken = generateTestToken({ userId: 3, role: 'admin' })
  })

  describe('Access Control', () => {
    test('GET /documents requires authentication', async () => {
      const res = await appRequest(app, 'GET', '/documents')
      expect(res.status).toBe(401)
    })

    test('GET /documents requires agent or admin role', async () => {
      const res = await appRequest(app, 'GET', '/documents', { token: clientToken })
      expect(res.status).toBe(403)
    })

    test('GET /documents/download/:token is public', async () => {
      // Create a document first
      await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'test.pdf',
          originalFilename: 'test.pdf',
          filePath: '/uploads/test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          category: 'property_docs',
          uploadedBy: 1,
        },
        token: agentToken,
      })
      
      const accessToken = documents[0].accessToken
      const res = await appRequest(app, 'GET', `/documents/download/${accessToken}`)
      expect(res.status).toBe(200)
    })
  })

  describe('CRUD Operations', () => {
    test('POST /documents creates a document', async () => {
      const res = await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'contract_001.pdf',
          originalFilename: 'Contract.pdf',
          filePath: '/uploads/contracts/contract_001.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          category: 'contracts',
          propertyId: 1,
          uploadedBy: 1,
        },
        token: agentToken,
      })
      expect(res.status).toBe(201)
      
      const { data } = await parseResponse(res)
      expect(data.id).toBe(1)
      expect(data.filename).toBe('contract_001.pdf')
      expect(data.accessToken).toBeDefined()
      expect(data.accessToken.length).toBe(32)
      expect(data.downloadCount).toBe(0)
    })

    test('GET /documents/:id returns a document', async () => {
      await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'image.jpg',
          originalFilename: 'photo.jpg',
          filePath: '/uploads/images/image.jpg',
          fileSize: 50000,
          mimeType: 'image/jpeg',
          category: 'property_images',
          uploadedBy: 1,
        },
        token: agentToken,
      })
      
      const res = await appRequest(app, 'GET', '/documents/1', { token: agentToken })
      expect(res.status).toBe(200)
      
      const { data } = await parseResponse(res)
      expect(data.originalFilename).toBe('photo.jpg')
    })

    test('PUT /documents/:id updates a document', async () => {
      await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'doc.pdf',
          originalFilename: 'Document.pdf',
          filePath: '/uploads/doc.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          category: 'other',
          isPublic: false,
          uploadedBy: 1,
        },
        token: agentToken,
      })
      
      const res = await appRequest(app, 'PUT', '/documents/1', {
        body: { category: 'contracts', isPublic: true },
        token: agentToken,
      })
      expect(res.status).toBe(200)
      
      const { data } = await parseResponse(res)
      expect(data.category).toBe('contracts')
      expect(data.isPublic).toBe(true)
    })

    test('DELETE /documents/:id soft deletes a document', async () => {
      await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'delete.pdf',
          originalFilename: 'Delete Me.pdf',
          filePath: '/uploads/delete.pdf',
          fileSize: 512,
          mimeType: 'application/pdf',
          uploadedBy: 1,
        },
        token: agentToken,
      })
      
      const res = await appRequest(app, 'DELETE', '/documents/1', { token: agentToken })
      expect(res.status).toBe(200)
      
      // Should not be found after delete
      const getRes = await appRequest(app, 'GET', '/documents/1', { token: agentToken })
      expect(getRes.status).toBe(404)
    })
  })

  describe('Download & Token Management', () => {
    test('Download increments counter', async () => {
      await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'download.pdf',
          originalFilename: 'Download Me.pdf',
          filePath: '/uploads/download.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: 1,
        },
        token: agentToken,
      })
      
      const accessToken = documents[0].accessToken
      
      // Download 3 times
      await appRequest(app, 'GET', `/documents/download/${accessToken}`)
      await appRequest(app, 'GET', `/documents/download/${accessToken}`)
      await appRequest(app, 'GET', `/documents/download/${accessToken}`)
      
      expect(documents[0].downloadCount).toBe(3)
    })

    test('Invalid token returns 404', async () => {
      const res = await appRequest(app, 'GET', '/documents/download/invalid-token-here')
      expect(res.status).toBe(404)
    })

    test('Expired link returns 403', async () => {
      await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'expired.pdf',
          originalFilename: 'Expired.pdf',
          filePath: '/uploads/expired.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: 1,
        },
        token: agentToken,
      })
      
      // Manually set expiry to past
      documents[0].expiresAt = new Date('2020-01-01')
      
      const res = await appRequest(app, 'GET', `/documents/download/${documents[0].accessToken}`)
      expect(res.status).toBe(403)
    })

    test('Regenerate token creates new token', async () => {
      await appRequest(app, 'POST', '/documents', {
        body: {
          filename: 'regen.pdf',
          originalFilename: 'Regenerate.pdf',
          filePath: '/uploads/regen.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: 1,
        },
        token: agentToken,
      })
      
      const oldToken = documents[0].accessToken
      
      const res = await appRequest(app, 'POST', '/documents/1/regenerate-token', { token: agentToken })
      expect(res.status).toBe(200)
      
      const { data } = await parseResponse(res)
      expect(data.accessToken).not.toBe(oldToken)
      expect(data.accessToken.length).toBe(32)
      
      // Old token should no longer work
      const downloadRes = await appRequest(app, 'GET', `/documents/download/${oldToken}`)
      expect(downloadRes.status).toBe(404)
    })
  })

  describe('Filtering', () => {
    beforeEach(async () => {
      const docs = [
        { filename: 'prop1.pdf', category: 'property_docs', propertyId: 1, isPublic: false },
        { filename: 'prop2.pdf', category: 'property_docs', propertyId: 2, isPublic: true },
        { filename: 'image1.jpg', category: 'property_images', propertyId: 1, isPublic: true },
        { filename: 'client1.pdf', category: 'client_docs', clientId: 1, isPublic: false },
        { filename: 'contract.pdf', category: 'contracts', propertyId: 1, clientId: 1, isPublic: false },
      ]
      
      for (const d of docs) {
        await appRequest(app, 'POST', '/documents', {
          body: {
            ...d,
            originalFilename: d.filename,
            filePath: `/uploads/${d.filename}`,
            fileSize: 1024,
            mimeType: d.filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
            uploadedBy: 1,
          },
          token: agentToken,
        })
      }
    })

    test('GET /documents returns all documents', async () => {
      const res = await appRequest(app, 'GET', '/documents', { token: agentToken })
      const { data, meta } = await parseResponse(res)
      
      expect(data.length).toBe(5)
      expect(meta.pagination.total).toBe(5)
    })

    test('GET /documents filters by category', async () => {
      const res = await appRequest(app, 'GET', '/documents?category=property_docs', { token: agentToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
      expect(data.every((d: any) => d.category === 'property_docs')).toBe(true)
    })

    test('GET /documents filters by propertyId', async () => {
      const res = await appRequest(app, 'GET', '/documents?propertyId=1', { token: agentToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(3) // prop1.pdf, image1.jpg, contract.pdf
    })

    test('GET /documents filters by isPublic', async () => {
      const res = await appRequest(app, 'GET', '/documents?isPublic=true', { token: agentToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
      expect(data.every((d: any) => d.isPublic === true)).toBe(true)
    })

    test('GET /documents combines filters', async () => {
      const res = await appRequest(app, 'GET', '/documents?propertyId=1&category=property_docs', { token: agentToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
      expect(data[0].filename).toBe('prop1.pdf')
    })
  })
})
