/**
 * E2E Scenario Tests
 * 
 * Full workflow tests simulating real user journeys.
 * These tests run against the Hono app in isolation mode.
 * For docker-compose based tests, use the run-e2e.sh script.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { appRequest, parseResponse, generateTestToken } from '../helpers'
import { buildUser, buildProperty, buildClient, buildCreateProperty, resetFactoryCounter } from '../factories'
import { apiResponse, apiError } from '../../src/utils/response'
import { errorHandler } from '../../src/middleware/errors'
import { validateBody } from '../../src/middleware/validation'
import { propertySchema, clientSchema } from '../../src/validation/schemas'
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError } from '../../src/types/errors'

// ── Mock Database for E2E ─────────────────────────────────────────

class MockDataStore {
  users: Map<number, any> = new Map()
  properties: Map<number, any> = new Map()
  clients: Map<number, any> = new Map()
  private idCounter = 0

  nextId() {
    return ++this.idCounter
  }

  reset() {
    this.users.clear()
    this.properties.clear()
    this.clients.clear()
    this.idCounter = 0
  }
}

const db = new MockDataStore()

// ── Build E2E App ─────────────────────────────────────────────────

function createE2EApp() {
  const app = new Hono()

  // Error handling
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(apiError(err.message, err.statusCode), err.statusCode as any)
    }
    console.error('Unhandled:', err)
    return c.json(apiError('Internal server error', 500), 500)
  })

  // Auth middleware
  const requireAuth = async (c: any, next: any) => {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid token')
    }
    // In real app, verify JWT and attach user
    c.set('userId', 1) // Mock
    await next()
  }

  const requireRole = (role: string) => async (c: any, next: any) => {
    const userRole = c.req.header('X-User-Role') || 'agent'
    if (role === 'admin' && userRole !== 'admin') {
      throw new ForbiddenError('Admin access required')
    }
    await next()
  }

  // Health
  app.get('/api/health', (c) => c.json(apiResponse({ status: 'healthy', timestamp: Date.now() })))

  // Properties CRUD
  app.get('/api/properties', (c) => {
    const properties = Array.from(db.properties.values())
    return c.json(apiResponse(properties))
  })

  app.get('/api/properties/:id', (c) => {
    const id = parseInt(c.req.param('id'))
    const property = db.properties.get(id)
    if (!property) throw new NotFoundError('Property')
    return c.json(apiResponse(property))
  })

  app.post('/api/properties', requireAuth, validateBody(propertySchema), async (c) => {
    const body = c.get('validatedBody')
    const id = db.nextId()
    const property = { id, ...body, createdAt: new Date(), updatedAt: new Date() }
    db.properties.set(id, property)
    return c.json(apiResponse(property), 201)
  })

  app.put('/api/properties/:id', requireAuth, validateBody(propertySchema.partial()), async (c) => {
    const id = parseInt(c.req.param('id'))
    const existing = db.properties.get(id)
    if (!existing) throw new NotFoundError('Property')
    
    const updates = c.get('validatedBody')
    const updated = { ...existing, ...updates, updatedAt: new Date() }
    db.properties.set(id, updated)
    return c.json(apiResponse(updated))
  })

  app.delete('/api/properties/:id', requireAuth, requireRole('admin'), async (c) => {
    const id = parseInt(c.req.param('id'))
    if (!db.properties.has(id)) throw new NotFoundError('Property')
    db.properties.delete(id)
    return c.json(apiResponse({ deleted: true }))
  })

  // Clients CRUD
  app.get('/api/clients', requireAuth, (c) => {
    const clients = Array.from(db.clients.values())
    return c.json(apiResponse(clients))
  })

  app.post('/api/clients', requireAuth, validateBody(clientSchema), async (c) => {
    const body = c.get('validatedBody')
    const id = db.nextId()
    const client = { id, ...body, createdAt: new Date(), updatedAt: new Date() }
    db.clients.set(id, client)
    return c.json(apiResponse(client), 201)
  })

  // Users (admin only)
  app.get('/api/users', requireAuth, requireRole('admin'), (c) => {
    const users = Array.from(db.users.values())
    return c.json(apiResponse(users))
  })

  return app
}

// ── E2E Scenarios ─────────────────────────────────────────────────

describe('E2E Scenarios', () => {
  let app: Hono
  const adminToken = generateTestToken({ userId: 1, role: 'admin' })
  const agentToken = generateTestToken({ userId: 2, role: 'agent' })

  beforeAll(() => {
    app = createE2EApp()
    db.reset()
    resetFactoryCounter()
  })

  afterAll(() => {
    db.reset()
  })

  describe('Scenario: Health check', () => {
    test('API is healthy and responding', async () => {
      const res = await appRequest(app, 'GET', '/api/health')
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('healthy')
    })
  })

  describe('Scenario: Property listing workflow', () => {
    let propertyId: number

    test('1. List properties (empty initially)', async () => {
      const res = await appRequest(app, 'GET', '/api/properties')
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.data).toEqual([])
    })

    test('2. Create a property (requires auth)', async () => {
      // Without auth - should fail
      const unauth = await appRequest(app, 'POST', '/api/properties', {
        body: { title: 'Test', address: 'Addr', city: 'City', propertyType: 'apartment', price: '100000' }
      })
      expect(unauth.status).toBe(401)

      // With auth - should succeed
      const res = await appRequest(app, 'POST', '/api/properties', {
        token: agentToken,
        body: {
          title: 'Beautiful Apartment',
          address: 'Calle Mayor 1',
          city: 'Madrid',
          propertyType: 'apartment',
          price: '250000',
          bedrooms: 3,
          bathrooms: 2,
        }
      })
      expect(res.status).toBe(201)
      const body = await parseResponse(res)
      expect(body.data.title).toBe('Beautiful Apartment')
      propertyId = body.data.id
    })

    test('3. Get property by ID', async () => {
      const res = await appRequest(app, 'GET', `/api/properties/${propertyId}`)
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.data.id).toBe(propertyId)
      expect(body.data.city).toBe('Madrid')
    })

    test('4. Update property', async () => {
      const res = await appRequest(app, 'PUT', `/api/properties/${propertyId}`, {
        token: agentToken,
        body: { price: '275000' }
      })
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.data.price).toBe('275000')
    })

    test('5. List properties (now has one)', async () => {
      const res = await appRequest(app, 'GET', '/api/properties')
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.data.length).toBe(1)
    })

    test('6. Delete property (admin only)', async () => {
      // Agent cannot delete
      const agentDelete = await appRequest(app, 'DELETE', `/api/properties/${propertyId}`, {
        token: agentToken,
        headers: { 'X-User-Role': 'agent' }
      })
      expect(agentDelete.status).toBe(403)

      // Admin can delete
      const adminDelete = await appRequest(app, 'DELETE', `/api/properties/${propertyId}`, {
        token: adminToken,
        headers: { 'X-User-Role': 'admin' }
      })
      expect(adminDelete.status).toBe(200)

      // Verify deleted
      const get = await appRequest(app, 'GET', `/api/properties/${propertyId}`)
      expect(get.status).toBe(404)
    })
  })

  describe('Scenario: Multi-user property management', () => {
    const agent1Token = generateTestToken({ userId: 10, role: 'agent', email: 'agent1@test.com' })
    const agent2Token = generateTestToken({ userId: 11, role: 'agent', email: 'agent2@test.com' })

    test('Multiple agents create properties concurrently', async () => {
      const createPromises = []

      // Agent 1 creates 5 properties
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          appRequest(app, 'POST', '/api/properties', {
            token: agent1Token,
            body: {
              title: `Agent1 Property ${i}`,
              address: `Calle ${i}`,
              city: 'Madrid',
              propertyType: 'apartment',
              price: String(100000 + i * 10000),
            }
          })
        )
      }

      // Agent 2 creates 5 properties
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          appRequest(app, 'POST', '/api/properties', {
            token: agent2Token,
            body: {
              title: `Agent2 Property ${i}`,
              address: `Avenida ${i}`,
              city: 'Barcelona',
              propertyType: 'house',
              price: String(200000 + i * 10000),
            }
          })
        )
      }

      const results = await Promise.all(createPromises)
      const allCreated = results.every(r => r.status === 201)
      expect(allCreated).toBe(true)

      // Verify all 10 exist
      const list = await appRequest(app, 'GET', '/api/properties')
      const body = await parseResponse(list)
      expect(body.data.length).toBe(10)
    })

    test('Concurrent reads are consistent', async () => {
      const readPromises = Array.from({ length: 20 }, () =>
        appRequest(app, 'GET', '/api/properties')
      )

      const results = await Promise.all(readPromises)
      const bodies = await Promise.all(results.map(r => parseResponse(r)))

      // All should return the same count
      const counts = bodies.map(b => b.data.length)
      expect(new Set(counts).size).toBe(1)
    })
  })

  describe('Scenario: Client management', () => {
    test('Create and list clients', async () => {
      // Create client
      const create = await appRequest(app, 'POST', '/api/clients', {
        token: agentToken,
        body: {
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '+34612345678',
        }
      })
      expect(create.status).toBe(201)

      // List clients
      const list = await appRequest(app, 'GET', '/api/clients', { token: agentToken })
      expect(list.status).toBe(200)
      const body = await parseResponse(list)
      expect(body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Scenario: Access control', () => {
    test('Unauthenticated access to protected routes fails', async () => {
      const endpoints = [
        { method: 'GET', path: '/api/clients' },
        { method: 'GET', path: '/api/users' },
        { method: 'POST', path: '/api/properties' },
      ]

      for (const { method, path } of endpoints) {
        const res = await appRequest(app, method, path, {
          body: method === 'POST' ? { title: 'Test' } : undefined
        })
        expect(res.status).toBe(401)
      }
    })

    test('Agent cannot access admin-only endpoints', async () => {
      const res = await appRequest(app, 'GET', '/api/users', {
        token: agentToken,
        headers: { 'X-User-Role': 'agent' }
      })
      expect(res.status).toBe(403)
    })

    test('Admin can access all endpoints', async () => {
      const res = await appRequest(app, 'GET', '/api/users', {
        token: adminToken,
        headers: { 'X-User-Role': 'admin' }
      })
      expect(res.status).toBe(200)
    })
  })

  describe('Scenario: Error handling', () => {
    test('404 for non-existent property', async () => {
      const res = await appRequest(app, 'GET', '/api/properties/999999')
      expect(res.status).toBe(404)
      const body = await parseResponse(res)
      expect(body.error.message).toContain('not found')
    })

    test('400 for invalid property data', async () => {
      const res = await appRequest(app, 'POST', '/api/properties', {
        token: agentToken,
        body: {
          title: '', // empty title
          address: 'Valid',
          city: 'Valid',
          propertyType: 'invalid_type',
          price: 'not-a-number',
        }
      })
      expect(res.status).toBe(400)
    })

    test('Update non-existent property returns 404', async () => {
      const res = await appRequest(app, 'PUT', '/api/properties/999999', {
        token: agentToken,
        body: { price: '100000' }
      })
      expect(res.status).toBe(404)
    })
  })
})

// ── Multi-User Race Condition Tests ───────────────────────────────

describe('Multi-User Race Conditions', () => {
  let app: Hono

  beforeAll(() => {
    app = createE2EApp()
    db.reset()
  })

  test('simultaneous property creation maintains data integrity', async () => {
    const tokens = Array.from({ length: 10 }, (_, i) =>
      generateTestToken({ userId: i + 100, role: 'agent' })
    )

    // All 10 users create property at exact same time
    const creates = tokens.map((token, i) =>
      appRequest(app, 'POST', '/api/properties', {
        token,
        body: {
          title: `Concurrent Property ${i}`,
          address: `Address ${i}`,
          city: 'Madrid',
          propertyType: 'apartment',
          price: String(100000 + i * 1000),
        }
      })
    )

    const results = await Promise.all(creates)
    
    // All should succeed
    expect(results.every(r => r.status === 201)).toBe(true)

    // All IDs should be unique
    const bodies = await Promise.all(results.map(r => parseResponse(r)))
    const ids = bodies.map(b => b.data.id)
    expect(new Set(ids).size).toBe(10)
  })
})
