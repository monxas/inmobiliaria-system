import { Hono } from 'hono'
import { documentsController } from '../controllers/documents.controller'
import { requireAuth, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'

const documents = new Hono<{ Variables: AppVariables }>()

// Public download route (uses access token)
documents.get('/download/:token', (c) => documentsController.download(c))

// Protected routes
documents.use('/*', requireAuth())

documents.get('/', requireRole(['admin', 'agent']), (c) => documentsController.findAll(c))
documents.get('/:id', requireRole(['admin', 'agent']), (c) => documentsController.findById(c))
documents.post('/upload', requireRole(['admin', 'agent']), (c) => documentsController.upload(c))
documents.put('/:id', requireRole(['admin', 'agent']), (c) => documentsController.update(c))
documents.delete('/:id', requireRole(['admin', 'agent']), (c) => documentsController.delete(c))
documents.post('/:id/regenerate-token', requireRole(['admin', 'agent']), (c) => documentsController.regenerateToken(c))

export { documents }
