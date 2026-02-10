import { Hono } from 'hono'
import { clientsController } from '../controllers/clients.controller'
import { requireAuth, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'

const clients = new Hono<{ Variables: AppVariables }>()

// All client routes require authentication
clients.use('/*', requireAuth())

// Agents and admins can manage clients
clients.get('/', requireRole(['admin', 'agent']), (c) => clientsController.findAll(c))
clients.get('/:id', requireRole(['admin', 'agent']), (c) => clientsController.findById(c))
clients.post('/', requireRole(['admin', 'agent']), (c) => clientsController.create(c))
clients.put('/:id', requireRole(['admin', 'agent']), (c) => clientsController.update(c))
clients.delete('/:id', requireRole(['admin', 'agent']), (c) => clientsController.delete(c))

export { clients }
