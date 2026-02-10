import { describe, test, expect, beforeEach } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errors'
import { validateBody, validateQuery } from '../../src/middleware/validation'
import { hashPassword } from '../../src/utils/crypto'
import { apiResponse, apiError } from '../../src/utils/response'
import { appRequest, parseResponse, generateTestToken } from '../helpers'
import { resetFactoryCounter } from '../factories'
import type { AppVariables } from '../../src/types'

/**
 * Users API Integration Tests
 * Simulates full CRUD with role-based access (admin only)
 */

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'agent', 'client']).default('client'),
  fullName: z.string().min(2),
  phone: z.string().optional(),
})

const updateUserSchema = createUserSchema.partial()

const filterQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
  email: z.string().optional(),
  role: z.enum(['admin', 'agent', 'client']).optional(),
  fullName: z.string().optional(),
})

interface MemUser {
  id: number
  email: string
  passwordHash: string
  role: 'admin' | 'agent' | 'client'
  fullName: string
  phone?: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

function createUsersApp() {
  const users: MemUser[] = []
  let nextId = 1

  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', errorHandler())

  // All user management requires admin role
  app.use('/users/*', requireAuth())
  app.use('/users/*', requireRole(['admin']))

  // List users
  app.get('/users', validateQuery(filterQuerySchema), async (c) => {
    const { page, limit, email, role, fullName } = c.get('validatedQuery')
    
    let filtered = users.filter(u => !u.deletedAt)
    
    if (email) filtered = filtered.filter(u => u.email.toLowerCase().includes(email.toLowerCase()))
    if (role) filtered = filtered.filter(u => u.role === role)
    if (fullName) filtered = filtered.filter(u => u.fullName.toLowerCase().includes(fullName.toLowerCase()))
    
    const pageNum = parseInt(page)
    const limitNum = Math.min(parseInt(limit), 100)
    const start = (pageNum - 1) * limitNum
    const paged = filtered.slice(start, start + limitNum)
    
    // Omit passwordHash from response
    const safeUsers = paged.map(({ passwordHash, ...u }) => u)
    
    return c.json(apiResponse(safeUsers, {
      pagination: { page: pageNum, limit: limitNum, total: filtered.length, pages: Math.ceil(filtered.length / limitNum) }
    }))
  })

  // Get by ID
  app.get('/users/:id', async (c) => {
    const id = parseInt(c.req.param('id'))
    const user = users.find(u => u.id === id && !u.deletedAt)
    if (!user) return c.json(apiError('User not found', 404), 404)
    
    const { passwordHash, ...safeUser } = user
    return c.json(apiResponse(safeUser))
  })

  // Create
  app.post('/users', validateBody(createUserSchema), async (c) => {
    const { email, password, role, fullName, phone } = c.get('validatedBody')
    
    if (users.find(u => u.email === email && !u.deletedAt)) {
      return c.json(apiError('Email already exists', 409), 409)
    }
    
    const user: MemUser = {
      id: nextId++,
      email,
      passwordHash: await hashPassword(password),
      role,
      fullName,
      phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    users.push(user)
    
    const { passwordHash, ...safeUser } = user
    return c.json(apiResponse(safeUser), 201)
  })

  // Update
  app.put('/users/:id', validateBody(updateUserSchema), async (c) => {
    const id = parseInt(c.req.param('id'))
    const user = users.find(u => u.id === id && !u.deletedAt)
    if (!user) return c.json(apiError('User not found', 404), 404)
    
    const updates = c.get('validatedBody')
    
    // Check email uniqueness if changing
    if (updates.email && updates.email !== user.email) {
      if (users.find(u => u.email === updates.email && !u.deletedAt)) {
        return c.json(apiError('Email already exists', 409), 409)
      }
    }
    
    if (updates.password) {
      user.passwordHash = await hashPassword(updates.password)
      delete updates.password
    }
    
    Object.assign(user, updates, { updatedAt: new Date() })
    
    const { passwordHash, ...safeUser } = user
    return c.json(apiResponse(safeUser))
  })

  // Delete
  app.delete('/users/:id', async (c) => {
    const id = parseInt(c.req.param('id'))
    const user = users.find(u => u.id === id && !u.deletedAt)
    if (!user) return c.json(apiError('User not found', 404), 404)
    
    user.deletedAt = new Date()
    return c.json(apiResponse({ id, deleted: true }))
  })

  return { app, users }
}

describe('Users API (Admin Only)', () => {
  let app: ReturnType<typeof createUsersApp>['app']
  let users: ReturnType<typeof createUsersApp>['users']
  let adminToken: string
  let agentToken: string

  beforeEach(() => {
    resetFactoryCounter()
    const result = createUsersApp()
    app = result.app
    users = result.users
    
    adminToken = generateTestToken({ userId: 1, role: 'admin', full_name: 'Admin User' })
    agentToken = generateTestToken({ userId: 2, role: 'agent', full_name: 'Agent User' })
  })

  describe('Access Control', () => {
    test('GET /users requires authentication', async () => {
      const res = await appRequest(app, 'GET', '/users')
      expect(res.status).toBe(401)
    })

    test('GET /users requires admin role', async () => {
      const res = await appRequest(app, 'GET', '/users', { token: agentToken })
      expect(res.status).toBe(403)
    })

    test('GET /users works for admin', async () => {
      const res = await appRequest(app, 'GET', '/users', { token: adminToken })
      expect(res.status).toBe(200)
    })
  })

  describe('CRUD Operations', () => {
    test('POST /users creates a user', async () => {
      const res = await appRequest(app, 'POST', '/users', {
        body: {
          email: 'newuser@test.com',
          password: 'password123',
          fullName: 'New User',
          role: 'agent',
        },
        token: adminToken,
      })
      expect(res.status).toBe(201)
      
      const { data } = await parseResponse(res)
      expect(data.id).toBe(1)
      expect(data.email).toBe('newuser@test.com')
      expect(data.role).toBe('agent')
      expect(data.passwordHash).toBeUndefined() // Should not expose password
    })

    test('POST /users rejects duplicate email', async () => {
      await appRequest(app, 'POST', '/users', {
        body: {
          email: 'duplicate@test.com',
          password: 'password123',
          fullName: 'User 1',
        },
        token: adminToken,
      })
      
      const res = await appRequest(app, 'POST', '/users', {
        body: {
          email: 'duplicate@test.com',
          password: 'password456',
          fullName: 'User 2',
        },
        token: adminToken,
      })
      expect(res.status).toBe(409)
    })

    test('POST /users validates password length', async () => {
      const res = await appRequest(app, 'POST', '/users', {
        body: {
          email: 'user@test.com',
          password: 'short',
          fullName: 'User',
        },
        token: adminToken,
      })
      expect(res.status).toBe(400)
    })

    test('GET /users/:id returns a user', async () => {
      await appRequest(app, 'POST', '/users', {
        body: {
          email: 'getme@test.com',
          password: 'password123',
          fullName: 'Get Me',
          role: 'client',
        },
        token: adminToken,
      })
      
      const res = await appRequest(app, 'GET', '/users/1', { token: adminToken })
      expect(res.status).toBe(200)
      
      const { data } = await parseResponse(res)
      expect(data.email).toBe('getme@test.com')
      expect(data.passwordHash).toBeUndefined()
    })

    test('GET /users/:id returns 404 for non-existent', async () => {
      const res = await appRequest(app, 'GET', '/users/999', { token: adminToken })
      expect(res.status).toBe(404)
    })

    test('PUT /users/:id updates a user', async () => {
      await appRequest(app, 'POST', '/users', {
        body: {
          email: 'update@test.com',
          password: 'password123',
          fullName: 'Before Update',
        },
        token: adminToken,
      })
      
      const res = await appRequest(app, 'PUT', '/users/1', {
        body: { fullName: 'After Update', role: 'admin' },
        token: adminToken,
      })
      expect(res.status).toBe(200)
      
      const { data } = await parseResponse(res)
      expect(data.fullName).toBe('After Update')
      expect(data.role).toBe('admin')
    })

    test('PUT /users/:id can change password', async () => {
      await appRequest(app, 'POST', '/users', {
        body: {
          email: 'pwchange@test.com',
          password: 'oldpassword123',
          fullName: 'Password User',
        },
        token: adminToken,
      })
      
      const res = await appRequest(app, 'PUT', '/users/1', {
        body: { password: 'newpassword456' },
        token: adminToken,
      })
      expect(res.status).toBe(200)
      
      // Verify password was actually hashed (check internal state)
      expect(users[0].passwordHash).not.toBe('newpassword456')
      expect(users[0].passwordHash.startsWith('$2')).toBe(true) // bcrypt hash
    })

    test('DELETE /users/:id soft deletes a user', async () => {
      await appRequest(app, 'POST', '/users', {
        body: {
          email: 'delete@test.com',
          password: 'password123',
          fullName: 'Delete Me',
        },
        token: adminToken,
      })
      
      const res = await appRequest(app, 'DELETE', '/users/1', { token: adminToken })
      expect(res.status).toBe(200)
      
      // Should not be found after delete
      const getRes = await appRequest(app, 'GET', '/users/1', { token: adminToken })
      expect(getRes.status).toBe(404)
    })
  })

  describe('Filtering', () => {
    beforeEach(async () => {
      const testUsers = [
        { email: 'admin1@test.com', password: 'pass12345', fullName: 'Admin One', role: 'admin' },
        { email: 'agent1@test.com', password: 'pass12345', fullName: 'Agent One', role: 'agent' },
        { email: 'agent2@test.com', password: 'pass12345', fullName: 'Agent Two', role: 'agent' },
        { email: 'client1@test.com', password: 'pass12345', fullName: 'Client One', role: 'client' },
        { email: 'client2@test.com', password: 'pass12345', fullName: 'Client Two', role: 'client' },
      ]
      
      for (const u of testUsers) {
        await appRequest(app, 'POST', '/users', { body: u, token: adminToken })
      }
    })

    test('GET /users returns all users', async () => {
      const res = await appRequest(app, 'GET', '/users', { token: adminToken })
      const { data, meta } = await parseResponse(res)
      
      expect(data.length).toBe(5)
      expect(meta.pagination.total).toBe(5)
    })

    test('GET /users filters by role', async () => {
      const res = await appRequest(app, 'GET', '/users?role=agent', { token: adminToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
      expect(data.every((u: any) => u.role === 'agent')).toBe(true)
    })

    test('GET /users filters by email', async () => {
      const res = await appRequest(app, 'GET', '/users?email=client', { token: adminToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
    })

    test('GET /users filters by fullName', async () => {
      const res = await appRequest(app, 'GET', '/users?fullName=one', { token: adminToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(3) // Admin One, Agent One, Client One
    })

    test('GET /users paginates correctly', async () => {
      const res = await appRequest(app, 'GET', '/users?page=1&limit=2', { token: adminToken })
      const { data, meta } = await parseResponse(res)
      
      expect(data.length).toBe(2)
      expect(meta.pagination.page).toBe(1)
      expect(meta.pagination.pages).toBe(3)
    })
  })
})
