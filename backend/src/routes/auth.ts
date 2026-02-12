import { Hono } from 'hono'
import { authController } from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth'
import type { AppVariables } from '../types'

const auth = new Hono<{ Variables: AppVariables }>()

// Public auth routes
auth.post('/login', (c) => authController.login(c))
auth.post('/register', (c) => authController.register(c))
auth.post('/refresh', (c) => authController.refresh(c))
auth.post('/logout', (c) => authController.logout(c))

// Google OAuth2 routes
auth.get('/google', (c) => authController.googleRedirect(c))
auth.get('/google/callback', (c) => authController.googleCallback(c))

// Protected profile routes
auth.get('/me', requireAuth(), (c) => authController.me(c))
auth.put('/me', requireAuth(), (c) => authController.updateMe(c))

// Session management (protected)
auth.post('/logout-all', requireAuth(), (c) => authController.logoutAll(c))
auth.get('/sessions', requireAuth(), (c) => authController.getSessions(c))
auth.delete('/sessions/:id', requireAuth(), (c) => authController.revokeSession(c))

export { auth }
