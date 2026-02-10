/**
 * Chaos Engineering Tests
 * 
 * Tests system resilience under failure conditions:
 * - Database connection failures
 * - Timeout scenarios
 * - Resource exhaustion
 * - Malformed requests
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { errorHandler } from '../../src/middleware/errors'
import { validateBody } from '../../src/middleware/validation'
import { rateLimiter } from '../../src/middleware/rate-limiter'
import { apiError, apiResponse } from '../../src/utils/response'
import { z } from 'zod'
import { appRequest, parseResponse } from '../helpers'

// ── Database Connection Simulation ────────────────────────────────

class MockDatabase {
  private connected = true
  private latency = 0
  private failRate = 0

  setConnected(value: boolean) {
    this.connected = value
  }

  setLatency(ms: number) {
    this.latency = ms
  }

  setFailRate(rate: number) {
    this.failRate = rate
  }

  async query<T>(sql: string): Promise<T[]> {
    // Simulate latency
    if (this.latency > 0) {
      await new Promise(r => setTimeout(r, this.latency))
    }

    // Simulate random failures
    if (Math.random() < this.failRate) {
      throw new Error('ECONNRESET: Connection reset by peer')
    }

    // Simulate connection failure
    if (!this.connected) {
      throw new Error('ENOTFOUND: Database connection refused')
    }

    return [] as T[]
  }

  reset() {
    this.connected = true
    this.latency = 0
    this.failRate = 0
  }
}

describe('Chaos Engineering', () => {
  const mockDb = new MockDatabase()

  beforeEach(() => {
    mockDb.reset()
  })

  describe('Database disconnect scenarios', () => {
    test('should return 503 when database is unavailable', async () => {
      const app = new Hono()
      app.onError((err, c) => {
        if (err.message.includes('ENOTFOUND') || err.message.includes('Connection')) {
          return c.json(apiError('Service temporarily unavailable', 503), 503)
        }
        return c.json(apiError('Internal error', 500), 500)
      })

      app.get('/properties', async (c) => {
        mockDb.setConnected(false)
        await mockDb.query('SELECT * FROM properties')
        return c.json(apiResponse([]))
      })

      const res = await appRequest(app, 'GET', '/properties')
      expect(res.status).toBe(503)
      const body = await parseResponse(res)
      expect(body.error.message).toContain('unavailable')
    })

    test('should handle intermittent connection failures gracefully', async () => {
      let attempts = 0
      const maxRetries = 3

      async function queryWithRetry<T>(query: () => Promise<T>): Promise<T> {
        for (let i = 0; i < maxRetries; i++) {
          try {
            attempts++
            return await query()
          } catch (err) {
            if (i === maxRetries - 1) throw err
            await new Promise(r => setTimeout(r, 10 * (i + 1))) // backoff
          }
        }
        throw new Error('Max retries exceeded')
      }

      const app = new Hono()
      app.onError((err, c) => c.json(apiError('Service error', 503), 503))

      app.get('/resilient', async (c) => {
        mockDb.setFailRate(0.5) // 50% failure rate
        const result = await queryWithRetry(() => mockDb.query('SELECT 1'))
        return c.json(apiResponse({ ok: true, attempts }))
      })

      // Try multiple times - retry logic should eventually succeed
      let successCount = 0
      for (let i = 0; i < 5; i++) {
        attempts = 0
        const res = await appRequest(app, 'GET', '/resilient')
        if (res.status === 200) successCount++
      }

      // With 50% fail rate and 3 retries, most should succeed
      expect(successCount).toBeGreaterThanOrEqual(3)
    })

    test('should timeout slow database queries', async () => {
      const app = new Hono()
      app.onError((err, c) => c.json(apiError(err.message, 504), 504))

      app.get('/slow', async (c) => {
        mockDb.setLatency(5000) // 5s latency

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 100) // 100ms timeout

        try {
          await Promise.race([
            mockDb.query('SELECT * FROM properties'),
            new Promise((_, reject) => {
              controller.signal.addEventListener('abort', () => {
                reject(new Error('Query timeout'))
              })
            })
          ])
          clearTimeout(timeout)
          return c.json(apiResponse([]))
        } catch (err: any) {
          clearTimeout(timeout)
          throw err
        }
      })

      const res = await appRequest(app, 'GET', '/slow')
      expect(res.status).toBe(504)
      const body = await parseResponse(res)
      expect(body.error.message).toContain('timeout')
    })
  })

  describe('Request flood resilience', () => {
    test('should handle 1000 concurrent requests without crashing', async () => {
      const app = new Hono()
      let requestCount = 0
      
      app.get('/flood', (c) => {
        requestCount++
        return c.json({ count: requestCount })
      })

      const requests = Array.from({ length: 1000 }, () =>
        appRequest(app, 'GET', '/flood')
      )

      const responses = await Promise.all(requests)
      const successCount = responses.filter(r => r.status === 200).length

      expect(successCount).toBe(1000)
      expect(requestCount).toBe(1000)
    })

    test('should maintain response consistency under load', async () => {
      const app = new Hono()
      app.get('/consistent/:id', (c) => {
        const id = c.req.param('id')
        return c.json(apiResponse({ id, timestamp: Date.now() }))
      })

      const ids = Array.from({ length: 100 }, (_, i) => String(i))
      const requests = ids.map(id => appRequest(app, 'GET', `/consistent/${id}`))
      const responses = await Promise.all(requests)

      for (let i = 0; i < responses.length; i++) {
        const body = await parseResponse(responses[i])
        expect(body.success).toBe(true)
        expect(body.data.id).toBe(ids[i])
      }
    })

    test('rate limiter should protect under burst traffic', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 50 }))
      app.get('/protected', (c) => c.json({ ok: true }))

      // Use unique IP for this test
      const testIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.1`
      
      // Send 100 requests rapidly
      const requests = Array.from({ length: 100 }, () =>
        appRequest(app, 'GET', '/protected', {
          headers: { 'X-Forwarded-For': testIp }
        })
      )
      const responses = await Promise.all(requests)

      const okCount = responses.filter(r => r.status === 200).length
      const blockedCount = responses.filter(r => r.status === 429).length

      expect(okCount).toBe(50)
      expect(blockedCount).toBe(50)
    })
  })

  describe('Malformed request handling', () => {
    test('should handle invalid JSON gracefully', async () => {
      const app = new Hono()
      app.onError((err, c) => c.json(apiError('Invalid request', 400), 400))
      app.post('/json', async (c) => {
        try {
          await c.req.json()
          return c.json({ ok: true })
        } catch {
          return c.json(apiError('Invalid JSON', 400), 400)
        }
      })

      const malformedJsons = [
        '{invalid}',
        '{"unclosed": ',
        '[1, 2, ]',
        'not json at all',
        '{"key": undefined}',
        '{"a": 1,}', // trailing comma
      ]

      for (const body of malformedJsons) {
        const req = new Request('http://localhost/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        const res = await app.fetch(req)
        expect(res.status).toBe(400)
      }
    })

    test('should handle extremely large payloads', async () => {
      const app = new Hono()
      app.post('/large', validateBody(z.object({ data: z.string().max(10000) })), (c) => {
        return c.json({ ok: true })
      })

      // 1MB string - should be rejected
      const hugePayload = { data: 'x'.repeat(1_000_000) }
      const res = await appRequest(app, 'POST', '/large', { body: hugePayload })
      expect(res.status).toBe(400)
    })

    test('should handle deeply nested objects', async () => {
      const app = new Hono()
      app.post('/nested', async (c) => {
        try {
          const body = await c.req.json()
          // Limit nesting depth
          const depth = JSON.stringify(body).split('{').length - 1
          if (depth > 10) {
            return c.json(apiError('Too deeply nested', 400), 400)
          }
          return c.json({ ok: true })
        } catch {
          return c.json(apiError('Invalid JSON', 400), 400)
        }
      })

      // Create deeply nested object
      let nested: any = { value: 'leaf' }
      for (let i = 0; i < 20; i++) {
        nested = { nested }
      }

      const res = await appRequest(app, 'POST', '/nested', { body: nested })
      expect(res.status).toBe(400)
    })

    test('should handle requests with missing Content-Type', async () => {
      const app = new Hono()
      app.post('/typed', async (c) => {
        const contentType = c.req.header('Content-Type')
        if (!contentType?.includes('application/json')) {
          return c.json(apiError('Content-Type must be application/json', 415), 415)
        }
        return c.json({ ok: true })
      })

      const req = new Request('http://localhost/typed', {
        method: 'POST',
        body: '{"test": 1}',
        // No Content-Type header
      })
      const res = await app.fetch(req)
      expect(res.status).toBe(415)
    })
  })

  describe('Memory pressure scenarios', () => {
    test('should not leak memory on repeated request/response cycles', async () => {
      const app = new Hono()
      app.get('/memory', (c) => {
        // Create some objects that should be garbage collected
        const data = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(100),
        }))
        return c.json(apiResponse(data))
      })

      const before = process.memoryUsage().heapUsed

      // Do 100 request/response cycles
      for (let i = 0; i < 100; i++) {
        const res = await appRequest(app, 'GET', '/memory')
        await res.json() // consume the body
      }

      // Force garbage collection if available
      if (global.gc) global.gc()

      const after = process.memoryUsage().heapUsed
      const increaseMB = (after - before) / 1024 / 1024

      // Should not increase by more than 20MB for 100 cycles
      expect(increaseMB).toBeLessThan(20)
    })
  })

  describe('Error cascade prevention', () => {
    test('single request failure should not affect others', async () => {
      const app = new Hono()
      let failOnId = 50 // Request 50 will fail

      app.onError((err, c) => c.json(apiError(err.message, 500), 500))

      app.get('/cascade/:id', async (c) => {
        const id = parseInt(c.req.param('id'))
        if (id === failOnId) {
          throw new Error('Simulated failure')
        }
        return c.json(apiResponse({ id }))
      })

      // Send 100 concurrent requests
      const requests = Array.from({ length: 100 }, (_, i) =>
        appRequest(app, 'GET', `/cascade/${i}`)
      )
      const responses = await Promise.all(requests)

      const successCount = responses.filter(r => r.status === 200).length
      const failCount = responses.filter(r => r.status === 500).length

      expect(successCount).toBe(99)
      expect(failCount).toBe(1)
    })
  })
})
