import { Hono } from 'hono'
import { usersController } from '../controllers/users.controller'
import { requireAuth, requireRole } from '../middleware/auth'
import type { AppVariables } from '../types'

const users = new Hono<{ Variables: AppVariables }>()

// All user management routes require admin
users.use('/*', requireAuth())
users.use('/*', requireRole(['admin']))

users.get('/', (c) => usersController.findAll(c))
users.get('/:id', (c) => usersController.findById(c))
users.post('/', (c) => usersController.create(c))
users.put('/:id', (c) => usersController.update(c))
users.delete('/:id', (c) => usersController.delete(c))

export { users }
