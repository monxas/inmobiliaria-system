import { describe, test, expect, beforeEach } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errors'
import { validateBody, validateQuery } from '../../src/middleware/validation'
import { apiResponse, apiError } from '../../src/utils/response'
import { appRequest, parseResponse, generateTestToken } from '../helpers'
import { buildProperty, buildCreateProperty, resetFactoryCounter } from '../factories'
import type { AppVariables } from '../../src/types'

/**
 * Properties API Integration Tests
 * Simulates full CRUD + filtering without real database
 */

// Schemas
const createPropertySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().optional(),
  country: z.string().default('España'),
  propertyType: z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']),
  status: z.enum(['available', 'reserved', 'sold', 'rented', 'off_market']).default('available'),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  surfaceArea: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  garage: z.boolean().default(false),
  garden: z.boolean().default(false),
})

const updatePropertySchema = createPropertySchema.partial()

const filterQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('10'),
  city: z.string().optional(),
  status: z.enum(['available', 'reserved', 'sold', 'rented', 'off_market']).optional(),
  propertyType: z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  minBedrooms: z.string().optional(),
})

// In-memory property store
interface MemProperty {
  id: number
  title: string
  description?: string
  address: string
  city: string
  postalCode?: string
  country: string
  propertyType: string
  status: string
  price: string
  surfaceArea?: number
  bedrooms?: number
  bathrooms?: number
  garage: boolean
  garden: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

function createPropertiesApp() {
  const properties: MemProperty[] = []
  let nextId = 1

  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', errorHandler())

  // List with filters
  app.get('/properties', validateQuery(filterQuerySchema), async (c) => {
    const { page, limit, city, status, propertyType, minPrice, maxPrice, minBedrooms } = c.get('validatedQuery')
    
    let filtered = properties.filter(p => !p.deletedAt)
    
    if (city) filtered = filtered.filter(p => p.city.toLowerCase().includes(city.toLowerCase()))
    if (status) filtered = filtered.filter(p => p.status === status)
    if (propertyType) filtered = filtered.filter(p => p.propertyType === propertyType)
    if (minPrice) filtered = filtered.filter(p => parseFloat(p.price) >= parseFloat(minPrice))
    if (maxPrice) filtered = filtered.filter(p => parseFloat(p.price) <= parseFloat(maxPrice))
    if (minBedrooms) filtered = filtered.filter(p => (p.bedrooms ?? 0) >= parseInt(minBedrooms))
    
    const pageNum = parseInt(page)
    const limitNum = Math.min(parseInt(limit), 100)
    const start = (pageNum - 1) * limitNum
    const paged = filtered.slice(start, start + limitNum)
    
    return c.json(apiResponse(paged, {
      pagination: { page: pageNum, limit: limitNum, total: filtered.length, pages: Math.ceil(filtered.length / limitNum) }
    }))
  })

  // Get by ID
  app.get('/properties/:id', async (c) => {
    const id = parseInt(c.req.param('id'))
    const property = properties.find(p => p.id === id && !p.deletedAt)
    if (!property) return c.json(apiError('Property not found', 404), 404)
    return c.json(apiResponse(property))
  })

  // Create (requires auth)
  app.post('/properties', requireAuth(), validateBody(createPropertySchema), async (c) => {
    const data = c.get('validatedBody')
    const property: MemProperty = {
      id: nextId++,
      ...data,
      country: data.country ?? 'España',
      status: data.status ?? 'available',
      garage: data.garage ?? false,
      garden: data.garden ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    properties.push(property)
    return c.json(apiResponse(property), 201)
  })

  // Update (requires auth)
  app.put('/properties/:id', requireAuth(), validateBody(updatePropertySchema), async (c) => {
    const id = parseInt(c.req.param('id'))
    const property = properties.find(p => p.id === id && !p.deletedAt)
    if (!property) return c.json(apiError('Property not found', 404), 404)
    
    const updates = c.get('validatedBody')
    Object.assign(property, updates, { updatedAt: new Date() })
    return c.json(apiResponse(property))
  })

  // Delete (requires auth + agent/admin)
  app.delete('/properties/:id', requireAuth(), requireRole(['admin', 'agent']), async (c) => {
    const id = parseInt(c.req.param('id'))
    const property = properties.find(p => p.id === id && !p.deletedAt)
    if (!property) return c.json(apiError('Property not found', 404), 404)
    
    property.deletedAt = new Date()
    return c.json(apiResponse({ id, deleted: true }))
  })

  return { app, properties }
}

describe('Properties API', () => {
  let app: ReturnType<typeof createPropertiesApp>['app']
  let properties: ReturnType<typeof createPropertiesApp>['properties']
  let agentToken: string
  let clientToken: string
  let adminToken: string

  beforeEach(() => {
    resetFactoryCounter()
    const result = createPropertiesApp()
    app = result.app
    properties = result.properties
    
    agentToken = generateTestToken({ userId: 1, role: 'agent' })
    clientToken = generateTestToken({ userId: 2, role: 'client' })
    adminToken = generateTestToken({ userId: 3, role: 'admin' })
  })

  describe('CRUD Operations', () => {
    test('POST /properties creates a property', async () => {
      const data = buildCreateProperty({ title: 'Test Villa', city: 'Barcelona' })
      
      const res = await appRequest(app, 'POST', '/properties', { body: data, token: agentToken })
      expect(res.status).toBe(201)
      
      const { data: property } = await parseResponse(res)
      expect(property.id).toBe(1)
      expect(property.title).toBe('Test Villa')
      expect(property.city).toBe('Barcelona')
      expect(property.status).toBe('available')
    })

    test('POST /properties requires authentication', async () => {
      const data = buildCreateProperty()
      const res = await appRequest(app, 'POST', '/properties', { body: data })
      expect(res.status).toBe(401)
    })

    test('POST /properties validates required fields', async () => {
      const res = await appRequest(app, 'POST', '/properties', { 
        body: { title: '' }, 
        token: agentToken 
      })
      expect(res.status).toBe(400)
    })

    test('GET /properties/:id returns a property', async () => {
      // Create first
      const data = buildCreateProperty({ title: 'Madrid Flat' })
      await appRequest(app, 'POST', '/properties', { body: data, token: agentToken })
      
      const res = await appRequest(app, 'GET', '/properties/1')
      expect(res.status).toBe(200)
      
      const { data: property } = await parseResponse(res)
      expect(property.title).toBe('Madrid Flat')
    })

    test('GET /properties/:id returns 404 for non-existent', async () => {
      const res = await appRequest(app, 'GET', '/properties/999')
      expect(res.status).toBe(404)
    })

    test('PUT /properties/:id updates a property', async () => {
      // Create first
      await appRequest(app, 'POST', '/properties', { 
        body: buildCreateProperty({ title: 'Old Title' }), 
        token: agentToken 
      })
      
      const res = await appRequest(app, 'PUT', '/properties/1', {
        body: { title: 'New Title', status: 'reserved' },
        token: agentToken
      })
      expect(res.status).toBe(200)
      
      const { data: property } = await parseResponse(res)
      expect(property.title).toBe('New Title')
      expect(property.status).toBe('reserved')
    })

    test('DELETE /properties/:id soft deletes a property', async () => {
      await appRequest(app, 'POST', '/properties', { 
        body: buildCreateProperty(), 
        token: agentToken 
      })
      
      const res = await appRequest(app, 'DELETE', '/properties/1', { token: agentToken })
      expect(res.status).toBe(200)
      
      // Should not be found after delete
      const getRes = await appRequest(app, 'GET', '/properties/1')
      expect(getRes.status).toBe(404)
    })

    test('DELETE /properties requires agent or admin role', async () => {
      await appRequest(app, 'POST', '/properties', { 
        body: buildCreateProperty(), 
        token: agentToken 
      })
      
      // Client cannot delete
      const res = await appRequest(app, 'DELETE', '/properties/1', { token: clientToken })
      expect(res.status).toBe(403)
    })
  })

  describe('Filtering & Pagination', () => {
    beforeEach(async () => {
      // Seed test data
      const props = [
        { title: 'Madrid Apt', city: 'Madrid', price: '200000.00', propertyType: 'apartment', bedrooms: 2 },
        { title: 'Madrid House', city: 'Madrid', price: '500000.00', propertyType: 'house', bedrooms: 4 },
        { title: 'Barcelona Office', city: 'Barcelona', price: '300000.00', propertyType: 'office', bedrooms: 0 },
        { title: 'Valencia Land', city: 'Valencia', price: '150000.00', propertyType: 'land', status: 'sold' },
        { title: 'Seville Warehouse', city: 'Seville', price: '400000.00', propertyType: 'warehouse' },
      ]
      
      for (const p of props) {
        await appRequest(app, 'POST', '/properties', {
          body: { ...buildCreateProperty(p as any), ...p },
          token: agentToken
        })
      }
    })

    test('GET /properties returns all available properties', async () => {
      const res = await appRequest(app, 'GET', '/properties')
      expect(res.status).toBe(200)
      
      const { data, meta } = await parseResponse(res)
      expect(data.length).toBe(5)
      expect(meta.pagination.total).toBe(5)
    })

    test('GET /properties filters by city', async () => {
      const res = await appRequest(app, 'GET', '/properties?city=Madrid')
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
      expect(data.every((p: any) => p.city === 'Madrid')).toBe(true)
    })

    test('GET /properties filters by status', async () => {
      const res = await appRequest(app, 'GET', '/properties?status=sold')
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
      expect(data[0].city).toBe('Valencia')
    })

    test('GET /properties filters by propertyType', async () => {
      const res = await appRequest(app, 'GET', '/properties?propertyType=apartment')
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
      expect(data[0].title).toBe('Madrid Apt')
    })

    test('GET /properties filters by price range', async () => {
      const res = await appRequest(app, 'GET', '/properties?minPrice=250000&maxPrice=450000')
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2) // Barcelona Office (300k) and Seville Warehouse (400k)
    })

    test('GET /properties filters by minimum bedrooms', async () => {
      const res = await appRequest(app, 'GET', '/properties?minBedrooms=3')
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
      expect(data[0].bedrooms).toBe(4)
    })

    test('GET /properties combines multiple filters', async () => {
      const res = await appRequest(app, 'GET', '/properties?city=Madrid&minPrice=300000')
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(1)
      expect(data[0].title).toBe('Madrid House')
    })

    test('GET /properties paginates correctly', async () => {
      const res = await appRequest(app, 'GET', '/properties?page=1&limit=2')
      const { data, meta } = await parseResponse(res)
      
      expect(data.length).toBe(2)
      expect(meta.pagination.page).toBe(1)
      expect(meta.pagination.limit).toBe(2)
      expect(meta.pagination.pages).toBe(3)
    })

    test('GET /properties page 2', async () => {
      const res = await appRequest(app, 'GET', '/properties?page=2&limit=2')
      const { data } = await parseResponse(res)
      
      expect(data.length).toBe(2)
    })

    test('GET /properties limits to max 100', async () => {
      const res = await appRequest(app, 'GET', '/properties?limit=500')
      const { meta } = await parseResponse(res)
      
      expect(meta.pagination.limit).toBe(100)
    })
  })
})
