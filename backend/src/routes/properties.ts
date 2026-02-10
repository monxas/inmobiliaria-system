import { Hono } from 'hono'
import { propertiesController } from '../controllers/properties.controller'
import { requireAuth, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'

const properties = new Hono<{ Variables: AppVariables }>()

// Public routes (optional auth for filtering by agent)
properties.get('/', (c) => propertiesController.findAll(c))
properties.get('/:id', (c) => propertiesController.findById(c))

// Protected routes
properties.use('/*', requireAuth())

properties.post('/', requireRole(['admin', 'agent']), (c) => propertiesController.create(c))
properties.put('/:id', requireRole(['admin', 'agent']), (c) => propertiesController.update(c))
properties.delete('/:id', requireRole(['admin', 'agent']), (c) => propertiesController.delete(c))

export { properties }
