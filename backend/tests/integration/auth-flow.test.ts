import { describe, test, expect } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errors'
import { validateBody } from '../../src/middleware/validation'
import { hashPassword, comparePassword, signJWT } from '../../src/utils/crypto'
import { apiResponse, apiError } from '../../src/utils/response'
import { appRequest, parseResponse, generateTestToken } from '../helpers'
import type { AppVariables } from '../../src/types'

/**
 * End-to-end auth flow test — simulates register → login → access protected route
 * without a real database (in-memory user store)
 */

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = loginSchema.extend({
  fullName: z.string().min(2),
  role: z.enum(['agent', 'client']).optional().default('client'),
})

// In-memory user store for testing
interface MemUser {
  id: number
  email: string
  passwordHash: string
  role: 'admin' | 'agent' | 'client'
  fullName: string
}

function createAuthApp() {
  const users: MemUser[] = []
  let nextId = 1

  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', errorHandler())

  // Register
  app.post('/auth/register', validateBody(registerSchema), async (c) => {
    const { email, password, fullName, role } = c.get('validatedBody')

    if (users.find(u => u.email === email)) {
      return c.json(apiError('Email already registered', 409), 409)
    }

    const passwordHash = await hashPassword(password)
    const user: MemUser = { id: nextId++, email, passwordHash, role, fullName }
    users.push(user)

    const token = signJWT({ userId: user.id, email, role, full_name: fullName })
    return c.json(apiResponse({ token, user: { id: user.id, email, role, fullName } }), 201)
  })

  // Login
  app.post('/auth/login', validateBody(loginSchema), async (c) => {
    const { email, password } = c.get('validatedBody')
    const user = users.find(u => u.email === email)

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return c.json(apiError('Invalid credentials', 401), 401)
    }

    const token = signJWT({ userId: user.id, email, role: user.role, full_name: user.fullName })
    return c.json(apiResponse({ token }))
  })

  // Protected profile
  app.get('/auth/me', requireAuth(), (c) => {
    return c.json(apiResponse(c.get('user')))
  })

  // Admin dashboard
  app.get('/admin/dashboard', requireAuth(), requireRole(['admin']), (c) => {
    return c.json(apiResponse({ users: users.length }))
  })

  return app
}

describe('Auth Flow (end-to-end)', () => {
  const app = createAuthApp()

  test('register → login → access profile', async () => {
    // 1. Register
    const regRes = await appRequest(app, 'POST', '/auth/register', {
      body: { email: 'alice@test.com', password: 'secret123', fullName: 'Alice Test' },
    })
    expect(regRes.status).toBe(201)
    const regBody = await parseResponse(regRes)
    expect(regBody.success).toBe(true)
    expect(regBody.data.token).toBeDefined()
    expect(regBody.data.user.email).toBe('alice@test.com')

    // 2. Login with same credentials
    const loginRes = await appRequest(app, 'POST', '/auth/login', {
      body: { email: 'alice@test.com', password: 'secret123' },
    })
    expect(loginRes.status).toBe(200)
    const loginBody = await parseResponse(loginRes)
    const token = loginBody.data.token

    // 3. Access protected route
    const meRes = await appRequest(app, 'GET', '/auth/me', { token })
    expect(meRes.status).toBe(200)
    const meBody = await parseResponse(meRes)
    expect(meBody.data.email).toBe('alice@test.com')
    expect(meBody.data.role).toBe('client')
  })

  test('should reject duplicate registration', async () => {
    // Register first
    await appRequest(app, 'POST', '/auth/register', {
      body: { email: 'bob@test.com', password: 'secret123', fullName: 'Bob' },
    })

    // Try again
    const res = await appRequest(app, 'POST', '/auth/register', {
      body: { email: 'bob@test.com', password: 'other123', fullName: 'Bob2' },
    })
    expect(res.status).toBe(409)
  })

  test('should reject wrong password', async () => {
    const res = await appRequest(app, 'POST', '/auth/login', {
      body: { email: 'alice@test.com', password: 'wrongpassword' },
    })
    expect(res.status).toBe(401)
  })

  test('should reject invalid registration data', async () => {
    const res = await appRequest(app, 'POST', '/auth/register', {
      body: { email: 'not-an-email', password: '12', fullName: '' },
    })
    expect(res.status).toBe(400)
  })

  test('should reject access to admin route for non-admin', async () => {
    const loginRes = await appRequest(app, 'POST', '/auth/login', {
      body: { email: 'alice@test.com', password: 'secret123' },
    })
    const { data } = await parseResponse(loginRes)

    const res = await appRequest(app, 'GET', '/admin/dashboard', { token: data.token })
    expect(res.status).toBe(403)
  })
})
