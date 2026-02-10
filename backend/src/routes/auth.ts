import { Hono } from 'hono'
import { usersController } from '../controllers/users.controller'
import { requireAuth } from '../middleware/auth'
import type { AppVariables } from '../types'

const auth = new Hono<{ Variables: AppVariables }>()

// Public auth routes
auth.post('/login', (c) => usersController.login(c))
auth.post('/register', (c) => usersController.register(c))

// Protected profile routes
auth.get('/me', requireAuth(), (c) => usersController.me(c))
auth.put('/me', requireAuth(), (c) => usersController.updateMe(c))

export { auth }
