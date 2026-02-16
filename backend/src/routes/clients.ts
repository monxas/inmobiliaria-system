import { Hono } from 'hono'
import { clientsController } from '../controllers/clients.controller'
import { requireAuth, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'

const clients = new Hono<{ Variables: AppVariables }>()

clients.use('/*', requireAuth())

// CRUD
clients.get('/', requireRole(['admin', 'agent']), (c) => clientsController.findAll(c))
clients.get('/:id', requireRole(['admin', 'agent']), (c) => clientsController.findById(c))
clients.post('/', requireRole(['admin', 'agent']), (c) => clientsController.create(c))
clients.put('/:id', requireRole(['admin', 'agent']), (c) => clientsController.update(c))
clients.delete('/:id', requireRole(['admin', 'agent']), (c) => clientsController.delete(c))

// Interactions
clients.get('/:id/interactions', requireRole(['admin', 'agent']), (c) => clientsController.getInteractions(c))
clients.post('/:id/interactions', requireRole(['admin', 'agent']), (c) => clientsController.addInteraction(c))

// Property Matching
clients.get('/:id/matches', requireRole(['admin', 'agent']), (c) => clientsController.getPropertyMatches(c))
clients.post('/:id/match-properties', requireRole(['admin', 'agent']), (c) => clientsController.matchProperties(c))

// Lead Score
clients.post('/:id/recalculate-score', requireRole(['admin', 'agent']), (c) => clientsController.recalculateScore(c))

export { clients }
