import { describe, test, expect } from 'bun:test'
import '../../setup'
import { Hono } from 'hono'
import { requireAuth, requireRole, requireOwnership } from '../../../src/middleware/auth'
import { appRequest, generateTestToken, parseResponse } from '../../helpers'
import type { AppVariables } from '../../../src/types'

function createTestApp() {
  const app = new Hono<{ Variables: AppVariables }>()

  // Protected route
  app.get('/protected', requireAuth(), (c) => {
    const user = c.get('user')
    return c.json({ user })
  })

  // Role-protected route
  app.get('/admin-only', requireAuth(), requireRole(['admin']), (c) => {
    return c.json({ ok: true })
  })

  // Ownership route
  app.get('/resource/:id', requireAuth(), requireOwnership(async (c) => {
    const id = Number(c.req.param('id'))
    // Simulate: resource 1 owned by user 1, resource 2 owned by user 2
    if (id === 1) return 1
    if (id === 2) return 2
    return null
  }), (c) => {
    return c.json({ ok: true })
  })

  return app
}

describe('auth middleware', () => {
  const app = createTestApp()

  describe('requireAuth', () => {
    test('should reject request without token', async () => {
      const res = await appRequest(app, 'GET', '/protected')
      expect(res.status).toBe(401)
      const body = await parseResponse(res)
      expect(body.error.message).toBe('Authentication required')
    })

    test('should reject invalid token', async () => {
      const res = await appRequest(app, 'GET', '/protected', { token: 'bad-token' })
      expect(res.status).toBe(401)
      const body = await parseResponse(res)
      expect(body.error.message).toBe('Invalid token')
    })

    test('should accept valid token and set user', async () => {
      const token = generateTestToken({ userId: 5, email: 'a@b.com', role: 'agent', full_name: 'Agent X' })
      const res = await appRequest(app, 'GET', '/protected', { token })
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.user.id).toBe(5)
      expect(body.user.email).toBe('a@b.com')
      expect(body.user.role).toBe('agent')
    })
  })

  describe('requireRole', () => {
    test('should allow admin to access admin-only route', async () => {
      const token = generateTestToken({ role: 'admin' })
      const res = await appRequest(app, 'GET', '/admin-only', { token })
      expect(res.status).toBe(200)
    })

    test('should reject agent from admin-only route', async () => {
      const token = generateTestToken({ role: 'agent' })
      const res = await appRequest(app, 'GET', '/admin-only', { token })
      expect(res.status).toBe(403)
    })

    test('should reject client from admin-only route', async () => {
      const token = generateTestToken({ role: 'client' })
      const res = await appRequest(app, 'GET', '/admin-only', { token })
      expect(res.status).toBe(403)
    })
  })

  describe('requireOwnership', () => {
    test('should allow owner to access their resource', async () => {
      const token = generateTestToken({ userId: 1, role: 'agent' })
      const res = await appRequest(app, 'GET', '/resource/1', { token })
      expect(res.status).toBe(200)
    })

    test('should reject non-owner', async () => {
      const token = generateTestToken({ userId: 1, role: 'agent' })
      const res = await appRequest(app, 'GET', '/resource/2', { token })
      expect(res.status).toBe(403)
    })

    test('should allow admin to bypass ownership', async () => {
      const token = generateTestToken({ userId: 99, role: 'admin' })
      const res = await appRequest(app, 'GET', '/resource/2', { token })
      expect(res.status).toBe(200)
    })

    test('should return 404 for non-existent resource', async () => {
      const token = generateTestToken({ userId: 1, role: 'agent' })
      const res = await appRequest(app, 'GET', '/resource/999', { token })
      expect(res.status).toBe(404)
    })
  })
})
