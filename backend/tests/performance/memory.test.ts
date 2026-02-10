import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { z } from 'zod'
import { validateBody } from '../../src/middleware/validation'
import { apiResponse } from '../../src/utils/response'
import { appRequest, parseResponse, measureTime } from '../helpers'
import { buildProperty, buildClient, resetFactoryCounter } from '../factories'

/**
 * Performance & Memory Tests
 * 
 * Target: <1.2GB RAM usage for NAS deployment
 * 
 * These tests verify:
 * 1. Memory doesn't grow unbounded with repeated requests
 * 2. Large dataset handling is efficient
 * 3. Concurrent request handling
 */

// Get memory usage in MB
function getMemoryMB(): number {
  if (typeof process !== 'undefined') {
    return process.memoryUsage().heapUsed / 1024 / 1024
  }
  return 0
}

describe('Memory & Performance', () => {
  
  describe('Memory Stability', () => {
    test('memory does not grow unbounded with 500 requests', async () => {
      const app = new Hono()
      app.get('/test', (c) => c.json({ ok: true }))
      
      const initialMemory = getMemoryMB()
      
      // Make 500 requests
      for (let i = 0; i < 500; i++) {
        await appRequest(app, 'GET', '/test')
      }
      
      // Force garbage collection if available
      if (typeof global.gc === 'function') {
        global.gc()
      }
      
      const finalMemory = getMemoryMB()
      const growth = finalMemory - initialMemory
      
      // Memory should not grow more than 50MB for 500 simple requests
      expect(growth).toBeLessThan(50)
    })

    test('memory does not grow unbounded with 100 large JSON responses', async () => {
      const app = new Hono()
      app.get('/large', (c) => {
        // Generate 1000 properties
        const data = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          title: `Property ${i}`,
          description: 'A'.repeat(500), // 500 chars each
          address: 'Some address',
          city: 'Madrid',
          price: '100000.00',
        }))
        return c.json(apiResponse(data))
      })
      
      const initialMemory = getMemoryMB()
      
      for (let i = 0; i < 100; i++) {
        const res = await appRequest(app, 'GET', '/large')
        // Don't keep reference to response body
        await res.text()
      }
      
      if (typeof global.gc === 'function') global.gc()
      
      const finalMemory = getMemoryMB()
      const growth = finalMemory - initialMemory
      
      // Should not grow more than 100MB even with large responses
      expect(growth).toBeLessThan(100)
    })

    test('POST requests with body parsing do not leak memory', async () => {
      const schema = z.object({
        name: z.string(),
        data: z.array(z.number()),
      })
      
      const app = new Hono()
      app.post('/submit', validateBody(schema), (c) => {
        return c.json(apiResponse({ received: true }))
      })
      
      const initialMemory = getMemoryMB()
      
      for (let i = 0; i < 200; i++) {
        await appRequest(app, 'POST', '/submit', {
          body: {
            name: 'Test',
            data: Array.from({ length: 1000 }, (_, j) => j), // Array of 1000 numbers
          }
        })
      }
      
      if (typeof global.gc === 'function') global.gc()
      
      const finalMemory = getMemoryMB()
      const growth = finalMemory - initialMemory
      
      expect(growth).toBeLessThan(75)
    })
  })

  describe('Response Time Benchmarks', () => {
    test('simple endpoint < 1ms average', async () => {
      const app = new Hono()
      app.get('/ping', (c) => c.json({ pong: true }))
      
      const times: number[] = []
      
      for (let i = 0; i < 100; i++) {
        const { durationMs } = await measureTime(() => appRequest(app, 'GET', '/ping'))
        times.push(durationMs)
      }
      
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      expect(avg).toBeLessThan(1)
    })

    test('JSON serialization of 100 items < 5ms', async () => {
      const app = new Hono()
      const items = Array.from({ length: 100 }, (_, i) => buildProperty({ id: i }))
      app.get('/properties', (c) => c.json(apiResponse(items)))
      
      const times: number[] = []
      
      for (let i = 0; i < 50; i++) {
        const { durationMs } = await measureTime(() => appRequest(app, 'GET', '/properties'))
        times.push(durationMs)
      }
      
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      expect(avg).toBeLessThan(5)
    })

    test('validation middleware < 0.5ms average', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string(),
      })
      
      const app = new Hono()
      app.post('/validate', validateBody(schema), (c) => c.json({ ok: true }))
      
      const times: number[] = []
      
      for (let i = 0; i < 100; i++) {
        const { durationMs } = await measureTime(() => 
          appRequest(app, 'POST', '/validate', {
            body: { email: 'test@test.com', password: 'password123', name: 'Test User' }
          })
        )
        times.push(durationMs)
      }
      
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      expect(avg).toBeLessThan(0.5)
    })
  })

  describe('Concurrent Request Handling', () => {
    test('handles 50 concurrent requests without errors', async () => {
      const app = new Hono()
      let counter = 0
      app.get('/concurrent', async (c) => {
        counter++
        await new Promise(r => setTimeout(r, 10)) // Simulate async work
        return c.json({ count: counter })
      })
      
      const promises = Array.from({ length: 50 }, () => 
        appRequest(app, 'GET', '/concurrent')
      )
      
      const responses = await Promise.all(promises)
      
      // All should succeed
      expect(responses.every(r => r.status === 200)).toBe(true)
      expect(counter).toBe(50)
    })

    test('handles 100 concurrent requests in < 500ms', async () => {
      const app = new Hono()
      app.get('/fast', (c) => c.json({ ok: true }))
      
      const start = performance.now()
      
      const promises = Array.from({ length: 100 }, () => 
        appRequest(app, 'GET', '/fast')
      )
      
      await Promise.all(promises)
      
      const duration = performance.now() - start
      expect(duration).toBeLessThan(500)
    })

    test('concurrent writes do not corrupt data', async () => {
      const app = new Hono()
      const items: { id: number; value: number }[] = []
      let nextId = 1
      
      app.post('/item', async (c) => {
        const id = nextId++
        await new Promise(r => setTimeout(r, Math.random() * 10))
        items.push({ id, value: id * 10 })
        return c.json({ id })
      })
      
      // 30 concurrent writes
      const promises = Array.from({ length: 30 }, () => 
        appRequest(app, 'POST', '/item')
      )
      
      await Promise.all(promises)
      
      // All items should be unique and have correct values
      expect(items.length).toBe(30)
      const ids = items.map(i => i.id)
      expect(new Set(ids).size).toBe(30) // All unique
      expect(items.every(i => i.value === i.id * 10)).toBe(true)
    })
  })

  describe('Pagination Performance', () => {
    test('paginated response of 10000 items handles efficiently', async () => {
      const allItems = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: i * 100,
      }))
      
      const app = new Hono()
      app.get('/items', (c) => {
        const page = parseInt(c.req.query('page') || '1')
        const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100)
        const start = (page - 1) * limit
        const items = allItems.slice(start, start + limit)
        
        return c.json(apiResponse(items, {
          pagination: {
            page,
            limit,
            total: allItems.length,
            pages: Math.ceil(allItems.length / limit),
          }
        }))
      })
      
      // Request different pages
      const { durationMs: firstPageTime } = await measureTime(() => 
        appRequest(app, 'GET', '/items?page=1&limit=50')
      )
      
      const { durationMs: middlePageTime } = await measureTime(() => 
        appRequest(app, 'GET', '/items?page=100&limit=50')
      )
      
      const { durationMs: lastPageTime } = await measureTime(() => 
        appRequest(app, 'GET', '/items?page=200&limit=50')
      )
      
      // All should be fast
      expect(firstPageTime).toBeLessThan(10)
      expect(middlePageTime).toBeLessThan(10)
      expect(lastPageTime).toBeLessThan(10)
      
      // No page should be significantly slower than others
      const variance = Math.max(firstPageTime, middlePageTime, lastPageTime) - 
                       Math.min(firstPageTime, middlePageTime, lastPageTime)
      expect(variance).toBeLessThan(5)
    })
  })

  describe('Startup & Initialization', () => {
    test('app initializes in < 100ms', async () => {
      const { durationMs } = await measureTime(async () => {
        const app = new Hono()
        // Simulate typical middleware stack
        app.use('*', async (c, next) => {
          c.set('startTime', Date.now())
          await next()
        })
        app.get('/health', (c) => c.json({ ok: true }))
        
        // First request (cold start)
        await appRequest(app, 'GET', '/health')
      })
      
      expect(durationMs).toBeLessThan(100)
    })
  })
})
