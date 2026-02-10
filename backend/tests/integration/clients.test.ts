import { describe, test, expect, beforeEach } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errors'
import { validateBody, validateQuery } from '../../src/middleware/validation'
import { apiResponse, apiError } from '../../src/utils/response'
import { appRequest, parseResponse, generateTestToken } from '../helpers'
import { buildClient, resetFactoryCounter } from '../factories'
import type { AppVariables } from '../../src/types'

/**
 * Clients API Integration Tests
 * Simulates full CRUD + relationships without real database
 */

// Schemas
const createClientSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

const updateClientSchema = createClientSchema.partial()

const listQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
  search: z.string().optional(),
  agentId: z.string().optional(),
})

const addPropertyRelationSchema = z.object({
  propertyId: z.number().int().positive(),
  relationshipType: z.enum(['interested', 'viewing', 'offer_made', 'contracted']).default('interested'),
  notes: z.string().optional(),
})

// In-memory stores
interface MemClient {
  id: number
  fullName: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  agentId?: number
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

interface MemClientProperty {
  id: number
  clientId: number
  propertyId: number
  relationshipType: string
  notes?: string
  createdAt: Date
}

function createClientsApp() {
  const clients: MemClient[] = []
  const clientProperties: MemClientProperty[] = []
  let nextClientId = 1
  let nextRelId = 1

  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', errorHandler())

  // All client endpoints require auth
  app.use('/clients/*', requireAuth())
  app.use('/clients', requireAuth())

  // List clients
  app.get('/clients', validateQuery(listQuerySchema), async (c) => {
    const { page, limit, search, agentId } = c.get('validatedQuery')
    const user = c.get('user')
    
    let filtered = clients.filter(cl => !cl.deletedAt)
    
    // Agents can only see their own clients (unless admin)
    if (user.role === 'agent') {
      filtered = filtered.filter(cl => cl.agentId === user.id)
    }
    
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(cl => 
        cl.fullName.toLowerCase().includes(q) || 
        cl.email?.toLowerCase().includes(q) ||
        cl.phone?.includes(q)
      )
    }
    
    if (agentId) {
      filtered = filtered.filter(cl => cl.agentId === parseInt(agentId))
    }
    
    const pageNum = parseInt(page)
    const limitNum = Math.min(parseInt(limit), 100)
    const start = (pageNum - 1) * limitNum
    const paged = filtered.slice(start, start + limitNum)
    
    return c.json(apiResponse(paged, {
      pagination: { page: pageNum, limit: limitNum, total: filtered.length, pages: Math.ceil(filtered.length / limitNum) }
    }))
  })

  // Get client by ID
  app.get('/clients/:id', async (c) => {
    const id = parseInt(c.req.param('id'))
    const user = c.get('user')
    const client = clients.find(cl => cl.id === id && !cl.deletedAt)
    
    if (!client) return c.json(apiError('Client not found', 404), 404)
    
    // Agents can only see their own clients (admin can see all)
    if (user.role === 'agent') {
      if (client.agentId !== user.id) {
        return c.json(apiError('Forbidden', 403), 403)
      }
    }
    
    return c.json(apiResponse(client))
  })

  // Create client
  app.post('/clients', requireRole(['admin', 'agent']), validateBody(createClientSchema), async (c) => {
    const data = c.get('validatedBody')
    const user = c.get('user')
    
    // Agents are automatically assigned as the client's agent
    const agentId = user.role === 'agent' ? user.id : data.agentId
    
    const client: MemClient = {
      id: nextClientId++,
      ...data,
      agentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    clients.push(client)
    return c.json(apiResponse(client), 201)
  })

  // Update client
  app.put('/clients/:id', requireRole(['admin', 'agent']), validateBody(updateClientSchema), async (c) => {
    const id = parseInt(c.req.param('id'))
    const user = c.get('user')
    const client = clients.find(cl => cl.id === id && !cl.deletedAt)
    
    if (!client) return c.json(apiError('Client not found', 404), 404)
    
    // Agents can only update their own clients
    if (user.role === 'agent' && client.agentId !== user.id) {
      return c.json(apiError('Forbidden', 403), 403)
    }
    
    const updates = c.get('validatedBody')
    Object.assign(client, updates, { updatedAt: new Date() })
    return c.json(apiResponse(client))
  })

  // Delete client
  app.delete('/clients/:id', requireRole(['admin', 'agent']), async (c) => {
    const id = parseInt(c.req.param('id'))
    const user = c.get('user')
    const client = clients.find(cl => cl.id === id && !cl.deletedAt)
    
    if (!client) return c.json(apiError('Client not found', 404), 404)
    
    if (user.role === 'agent' && client.agentId !== user.id) {
      return c.json(apiError('Forbidden', 403), 403)
    }
    
    client.deletedAt = new Date()
    return c.json(apiResponse({ id, deleted: true }))
  })

  // --- Client-Property Relationships ---
  
  // Get client's interested properties
  app.get('/clients/:id/properties', async (c) => {
    const clientId = parseInt(c.req.param('id'))
    const user = c.get('user')
    const client = clients.find(cl => cl.id === clientId && !cl.deletedAt)
    
    if (!client) return c.json(apiError('Client not found', 404), 404)
    
    if (user.role === 'agent' && client.agentId !== user.id) {
      return c.json(apiError('Forbidden', 403), 403)
    }
    
    const relations = clientProperties.filter(cp => cp.clientId === clientId)
    return c.json(apiResponse(relations))
  })

  // Add property interest
  app.post('/clients/:id/properties', requireRole(['admin', 'agent']), validateBody(addPropertyRelationSchema), async (c) => {
    const clientId = parseInt(c.req.param('id'))
    const user = c.get('user')
    const client = clients.find(cl => cl.id === clientId && !cl.deletedAt)
    
    if (!client) return c.json(apiError('Client not found', 404), 404)
    
    if (user.role === 'agent' && client.agentId !== user.id) {
      return c.json(apiError('Forbidden', 403), 403)
    }
    
    const { propertyId, relationshipType, notes } = c.get('validatedBody')
    
    // Check for duplicate
    const existing = clientProperties.find(cp => cp.clientId === clientId && cp.propertyId === propertyId)
    if (existing) {
      return c.json(apiError('Relationship already exists', 409), 409)
    }
    
    const relation: MemClientProperty = {
      id: nextRelId++,
      clientId,
      propertyId,
      relationshipType,
      notes,
      createdAt: new Date(),
    }
    clientProperties.push(relation)
    return c.json(apiResponse(relation), 201)
  })

  // Remove property interest
  app.delete('/clients/:clientId/properties/:propertyId', requireRole(['admin', 'agent']), async (c) => {
    const clientId = parseInt(c.req.param('clientId'))
    const propertyId = parseInt(c.req.param('propertyId'))
    const user = c.get('user')
    const client = clients.find(cl => cl.id === clientId && !cl.deletedAt)
    
    if (!client) return c.json(apiError('Client not found', 404), 404)
    
    if (user.role === 'agent' && client.agentId !== user.id) {
      return c.json(apiError('Forbidden', 403), 403)
    }
    
    const idx = clientProperties.findIndex(cp => cp.clientId === clientId && cp.propertyId === propertyId)
    if (idx === -1) {
      return c.json(apiError('Relationship not found', 404), 404)
    }
    
    clientProperties.splice(idx, 1)
    return c.json(apiResponse({ clientId, propertyId, deleted: true }))
  })

  return { app, clients, clientProperties }
}

describe('Clients API', () => {
  let app: ReturnType<typeof createClientsApp>['app']
  let clients: ReturnType<typeof createClientsApp>['clients']
  let clientProperties: ReturnType<typeof createClientsApp>['clientProperties']
  let agent1Token: string
  let agent2Token: string
  let adminToken: string
  let clientToken: string

  beforeEach(() => {
    resetFactoryCounter()
    const result = createClientsApp()
    app = result.app
    clients = result.clients
    clientProperties = result.clientProperties
    
    agent1Token = generateTestToken({ userId: 1, role: 'agent', full_name: 'Agent One' })
    agent2Token = generateTestToken({ userId: 2, role: 'agent', full_name: 'Agent Two' })
    adminToken = generateTestToken({ userId: 10, role: 'admin', full_name: 'Admin' })
    clientToken = generateTestToken({ userId: 20, role: 'client', full_name: 'A Client' })
  })

  describe('CRUD Operations', () => {
    test('POST /clients creates a client', async () => {
      const res = await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'María García', email: 'maria@test.com', phone: '+34611222333' },
        token: agent1Token
      })
      expect(res.status).toBe(201)
      
      const { data } = await parseResponse(res)
      expect(data.id).toBe(1)
      expect(data.fullName).toBe('María García')
      expect(data.agentId).toBe(1) // Assigned to agent who created
    })

    test('POST /clients requires agent or admin role', async () => {
      const res = await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Test Client' },
        token: clientToken
      })
      expect(res.status).toBe(403)
    })

    test('POST /clients validates required fields', async () => {
      const res = await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'A' }, // Too short
        token: agent1Token
      })
      expect(res.status).toBe(400)
    })

    test('GET /clients/:id returns a client', async () => {
      // Create first
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Juan Pérez' },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'GET', '/clients/1', { token: agent1Token })
      expect(res.status).toBe(200)
      
      const { data } = await parseResponse(res)
      expect(data.fullName).toBe('Juan Pérez')
    })

    test('Agent cannot see another agent\'s clients', async () => {
      // Agent 1 creates client
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Agent 1 Client' },
        token: agent1Token
      })
      
      // Agent 2 tries to access
      const res = await appRequest(app, 'GET', '/clients/1', { token: agent2Token })
      expect(res.status).toBe(403)
    })

    test('Admin can see any client', async () => {
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Someone' },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'GET', '/clients/1', { token: adminToken })
      expect(res.status).toBe(200)
    })

    test('PUT /clients/:id updates a client', async () => {
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Old Name' },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'PUT', '/clients/1', {
        body: { fullName: 'New Name', notes: 'VIP client' },
        token: agent1Token
      })
      expect(res.status).toBe(200)
      
      const { data } = await parseResponse(res)
      expect(data.fullName).toBe('New Name')
      expect(data.notes).toBe('VIP client')
    })

    test('DELETE /clients/:id soft deletes', async () => {
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'To Delete' },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'DELETE', '/clients/1', { token: agent1Token })
      expect(res.status).toBe(200)
      
      // Should not find after delete
      const getRes = await appRequest(app, 'GET', '/clients/1', { token: agent1Token })
      expect(getRes.status).toBe(404)
    })
  })

  describe('Search & Filtering', () => {
    beforeEach(async () => {
      // Agent 1 creates clients
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Ana Martínez', email: 'ana@test.com', phone: '+34611111111' },
        token: agent1Token
      })
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Pedro López', email: 'pedro@test.com', phone: '+34622222222' },
        token: agent1Token
      })
      // Agent 2 creates clients
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Laura García', email: 'laura@test.com' },
        token: agent2Token
      })
    })

    test('Agent sees only their own clients', async () => {
      const res = await appRequest(app, 'GET', '/clients', { token: agent1Token })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
      expect(data.every((c: any) => c.agentId === 1)).toBe(true)
    })

    test('Admin sees all clients', async () => {
      const res = await appRequest(app, 'GET', '/clients', { token: adminToken })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(3)
    })

    test('Search by name', async () => {
      const res = await appRequest(app, 'GET', '/clients?search=ana', { token: agent1Token })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
      expect(data[0].fullName).toBe('Ana Martínez')
    })

    test('Search by email', async () => {
      const res = await appRequest(app, 'GET', '/clients?search=pedro@', { token: agent1Token })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
      expect(data[0].fullName).toBe('Pedro López')
    })

    test('Search by phone', async () => {
      const res = await appRequest(app, 'GET', '/clients?search=611111', { token: agent1Token })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
    })
  })

  describe('Client-Property Relationships', () => {
    beforeEach(async () => {
      await appRequest(app, 'POST', '/clients', {
        body: { fullName: 'Interested Buyer' },
        token: agent1Token
      })
    })

    test('POST /clients/:id/properties adds property interest', async () => {
      const res = await appRequest(app, 'POST', '/clients/1/properties', {
        body: { propertyId: 100, relationshipType: 'interested', notes: 'Called about this' },
        token: agent1Token
      })
      expect(res.status).toBe(201)
      
      const { data } = await parseResponse(res)
      expect(data.clientId).toBe(1)
      expect(data.propertyId).toBe(100)
      expect(data.relationshipType).toBe('interested')
    })

    test('Cannot add duplicate relationship', async () => {
      await appRequest(app, 'POST', '/clients/1/properties', {
        body: { propertyId: 100 },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'POST', '/clients/1/properties', {
        body: { propertyId: 100 },
        token: agent1Token
      })
      expect(res.status).toBe(409)
    })

    test('GET /clients/:id/properties lists relationships', async () => {
      await appRequest(app, 'POST', '/clients/1/properties', {
        body: { propertyId: 100 },
        token: agent1Token
      })
      await appRequest(app, 'POST', '/clients/1/properties', {
        body: { propertyId: 200, relationshipType: 'viewing' },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'GET', '/clients/1/properties', { token: agent1Token })
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
    })

    test('DELETE /clients/:clientId/properties/:propertyId removes relationship', async () => {
      await appRequest(app, 'POST', '/clients/1/properties', {
        body: { propertyId: 100 },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'DELETE', '/clients/1/properties/100', { token: agent1Token })
      expect(res.status).toBe(200)
      
      const listRes = await appRequest(app, 'GET', '/clients/1/properties', { token: agent1Token })
      const { data } = await parseResponse(listRes)
      expect(data.length).toBe(0)
    })

    test('Agent cannot access other agent\'s client relationships', async () => {
      await appRequest(app, 'POST', '/clients/1/properties', {
        body: { propertyId: 100 },
        token: agent1Token
      })
      
      const res = await appRequest(app, 'GET', '/clients/1/properties', { token: agent2Token })
      expect(res.status).toBe(403)
    })
  })
})
