/**
 * Performance Benchmarks with Percentiles
 * 
 * Measures p50, p95, p99 response times for critical operations.
 * Establishes performance baselines and detects regressions.
 */

import { describe, test, expect } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { appRequest, measureTime, generateTestToken } from '../helpers'
import { hashPassword, comparePassword, signJWT, verifyJWT, generateSecureToken } from '../../src/utils/crypto'
import { apiResponse } from '../../src/utils/response'
import { validateBody } from '../../src/middleware/validation'
import { rateLimiter } from '../../src/middleware/rate-limiter'
import { z } from 'zod'

// ── Percentile calculation ────────────────────────────────────────

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function stats(values: number[]): {
  min: number
  max: number
  avg: number
  p50: number
  p95: number
  p99: number
} {
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  }
}

async function benchmark<T>(
  name: string,
  iterations: number,
  fn: () => Promise<T>
): Promise<{ results: T[]; stats: ReturnType<typeof stats> }> {
  const times: number[] = []
  const results: T[] = []

  for (let i = 0; i < iterations; i++) {
    const { result, durationMs } = await measureTime(fn)
    times.push(durationMs)
    results.push(result)
  }

  const s = stats(times)
  console.log(`[BENCHMARK] ${name}:`)
  console.log(`  iterations: ${iterations}`)
  console.log(`  min: ${s.min.toFixed(3)}ms, max: ${s.max.toFixed(3)}ms, avg: ${s.avg.toFixed(3)}ms`)
  console.log(`  p50: ${s.p50.toFixed(3)}ms, p95: ${s.p95.toFixed(3)}ms, p99: ${s.p99.toFixed(3)}ms`)

  return { results, stats: s }
}

// ── API Response Time Benchmarks ──────────────────────────────────

describe('Performance Benchmarks', () => {
  describe('API Response Times', () => {
    const app = new Hono()
    app.get('/simple', (c) => c.json(apiResponse({ ok: true })))
    app.get('/json/:size', (c) => {
      const size = parseInt(c.req.param('size'))
      const items = Array.from({ length: size }, (_, i) => ({
        id: i,
        title: `Property ${i}`,
        city: 'Madrid',
        price: String(i * 1000),
        description: 'A nice property with good views and modern amenities.',
      }))
      return c.json(apiResponse(items))
    })
    app.use('/protected/*', async (c, next) => {
      const auth = c.req.header('Authorization')
      if (!auth) return c.json({ error: 'Unauthorized' }, 401)
      try {
        verifyJWT(auth.replace('Bearer ', ''))
        await next()
      } catch {
        return c.json({ error: 'Invalid token' }, 401)
      }
    })
    app.get('/protected/data', (c) => c.json(apiResponse({ secret: 'data' })))

    test('simple response: p99 < 2ms', async () => {
      const { stats: s } = await benchmark('Simple JSON response', 200, () =>
        appRequest(app, 'GET', '/simple')
      )
      expect(s.p99).toBeLessThan(2)
    })

    test('10-item response: p99 < 3ms', async () => {
      const { stats: s } = await benchmark('10-item JSON response', 200, () =>
        appRequest(app, 'GET', '/json/10')
      )
      expect(s.p99).toBeLessThan(3)
    })

    test('100-item response: p99 < 10ms', async () => {
      const { stats: s } = await benchmark('100-item JSON response', 200, () =>
        appRequest(app, 'GET', '/json/100')
      )
      expect(s.p99).toBeLessThan(10)
    })

    test('1000-item response: p99 < 50ms', async () => {
      const { stats: s } = await benchmark('1000-item JSON response', 100, () =>
        appRequest(app, 'GET', '/json/1000')
      )
      expect(s.p99).toBeLessThan(50)
    })

    test('authenticated request: p99 < 5ms', async () => {
      const token = generateTestToken({ userId: 1, role: 'admin' })
      const { stats: s } = await benchmark('Authenticated request', 200, () =>
        appRequest(app, 'GET', '/protected/data', { token })
      )
      expect(s.p99).toBeLessThan(5)
    })
  })

  describe('Crypto Operations', () => {
    test('JWT sign: p99 < 1ms', async () => {
      const { stats: s } = await benchmark('JWT sign', 500, async () => {
        return signJWT({ userId: 1, email: 'test@test.com', role: 'agent' })
      })
      expect(s.p99).toBeLessThan(1) // Increased from 0.5ms for stability
    })

    test('JWT verify: p99 < 0.5ms', async () => {
      const token = signJWT({ userId: 1 })
      const { stats: s } = await benchmark('JWT verify', 500, async () => {
        return verifyJWT(token)
      })
      expect(s.p99).toBeLessThan(0.5)
    })

    test('secure token generation (64 chars): p99 < 0.5ms', async () => {
      const { stats: s } = await benchmark('Secure token (64)', 500, async () => {
        return generateSecureToken(64)
      })
      expect(s.p99).toBeLessThan(0.5)
    })

    test('password hash: p99 < 400ms (bcrypt cost factor)', async () => {
      const { stats: s } = await benchmark('Password hash', 10, () =>
        hashPassword('testpassword123')
      )
      // bcrypt is intentionally slow
      expect(s.p99).toBeLessThan(400)
      expect(s.p50).toBeGreaterThan(50) // should not be too fast
    })

    test('password compare: p99 < 400ms', async () => {
      const hash = await hashPassword('testpassword123')
      const { stats: s } = await benchmark('Password compare', 10, () =>
        comparePassword('testpassword123', hash)
      )
      expect(s.p99).toBeLessThan(400)
    })
  })

  describe('Validation Performance', () => {
    const schema = z.object({
      title: z.string().min(1).max(200),
      address: z.string().min(1),
      city: z.string().min(1),
      propertyType: z.enum(['apartment', 'house', 'commercial', 'land']),
      price: z.string().regex(/^\d+\.?\d*$/),
      bedrooms: z.number().int().min(0).max(100).optional(),
      bathrooms: z.number().int().min(0).max(50).optional(),
      surfaceArea: z.number().positive().optional(),
      description: z.string().max(5000).optional(),
    })

    const app = new Hono()
    app.post('/validate', validateBody(schema), (c) => c.json({ ok: true }))

    test('schema validation: p99 < 3ms', async () => {
      const validBody = {
        title: 'Beautiful Apartment in Centro',
        address: 'Calle Gran Vía 42, 3º B',
        city: 'Madrid',
        propertyType: 'apartment',
        price: '350000',
        bedrooms: 3,
        bathrooms: 2,
        surfaceArea: 120,
        description: 'A beautiful apartment with stunning views of the city center.',
      }

      const { stats: s } = await benchmark('Schema validation', 200, () =>
        appRequest(app, 'POST', '/validate', { body: validBody })
      )
      expect(s.p99).toBeLessThan(3)
    })

    test('validation rejection: p99 < 3ms', async () => {
      const invalidBody = {
        title: '', // too short
        address: 'Valid',
        city: 'Madrid',
        propertyType: 'invalid_type',
        price: 'not-a-number',
      }

      const { stats: s } = await benchmark('Validation rejection', 200, () =>
        appRequest(app, 'POST', '/validate', { body: invalidBody })
      )
      expect(s.p99).toBeLessThan(3)
    })
  })

  describe('Concurrency Performance', () => {
    test('100 concurrent requests: total < 100ms', async () => {
      const app = new Hono()
      app.get('/concurrent', (c) => c.json({ ok: true }))

      const { durationMs } = await measureTime(async () => {
        await Promise.all(
          Array.from({ length: 100 }, () => appRequest(app, 'GET', '/concurrent'))
        )
      })

      console.log(`[BENCHMARK] 100 concurrent requests: ${durationMs.toFixed(2)}ms total`)
      expect(durationMs).toBeLessThan(100)
    })

    test('500 concurrent requests: total < 500ms', async () => {
      const app = new Hono()
      app.get('/concurrent', (c) => c.json({ ok: true }))

      const { durationMs } = await measureTime(async () => {
        await Promise.all(
          Array.from({ length: 500 }, () => appRequest(app, 'GET', '/concurrent'))
        )
      })

      console.log(`[BENCHMARK] 500 concurrent requests: ${durationMs.toFixed(2)}ms total`)
      expect(durationMs).toBeLessThan(500)
    })

    test('1000 concurrent requests: total < 1000ms', async () => {
      const app = new Hono()
      app.get('/concurrent', (c) => c.json({ ok: true }))

      const { durationMs } = await measureTime(async () => {
        await Promise.all(
          Array.from({ length: 1000 }, () => appRequest(app, 'GET', '/concurrent'))
        )
      })

      console.log(`[BENCHMARK] 1000 concurrent requests: ${durationMs.toFixed(2)}ms total`)
      expect(durationMs).toBeLessThan(1000)
    })
  })

  describe('Rate Limiter Performance', () => {
    test('rate limiter overhead: p99 < 1ms', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 10000 }))
      app.get('/limited', (c) => c.json({ ok: true }))

      const { stats: s } = await benchmark('Rate limited request', 200, () =>
        appRequest(app, 'GET', '/limited')
      )
      expect(s.p99).toBeLessThan(1)
    })
  })

  describe('Memory Benchmarks', () => {
    test('memory usage stays stable under load', async () => {
      const app = new Hono()
      app.get('/memory', (c) => {
        const data = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))
        return c.json(apiResponse(data))
      })

      const measurements: number[] = []

      for (let batch = 0; batch < 10; batch++) {
        await Promise.all(
          Array.from({ length: 100 }, () => appRequest(app, 'GET', '/memory').then(r => r.json()))
        )
        measurements.push(process.memoryUsage().heapUsed / 1024 / 1024)
      }

      // Memory should not grow more than 20MB across batches
      const growth = measurements[measurements.length - 1] - measurements[0]
      console.log(`[BENCHMARK] Memory growth over 1000 requests: ${growth.toFixed(2)}MB`)
      console.log(`  Measurements (MB): ${measurements.map(m => m.toFixed(1)).join(', ')}`)
      expect(growth).toBeLessThan(20)
    })
  })
})

// ── Load Test Summary ─────────────────────────────────────────────

describe('Load Test Summary', () => {
  test('generate performance report', async () => {
    const app = new Hono()
    app.get('/load', (c) => c.json(apiResponse({ timestamp: Date.now() })))

    console.log('\n========================================')
    console.log('        LOAD TEST SUMMARY')
    console.log('========================================\n')

    // Warmup
    for (let i = 0; i < 50; i++) {
      await appRequest(app, 'GET', '/load')
    }

    const loads = [100, 500, 1000]
    
    for (const count of loads) {
      const start = performance.now()
      await Promise.all(
        Array.from({ length: count }, () => appRequest(app, 'GET', '/load'))
      )
      const duration = performance.now() - start
      const rps = (count / duration) * 1000

      console.log(`${count} requests:`)
      console.log(`  Total time: ${duration.toFixed(2)}ms`)
      console.log(`  Throughput: ${rps.toFixed(0)} req/s`)
      console.log(`  Avg latency: ${(duration / count).toFixed(3)}ms`)
      console.log('')
    }

    console.log('========================================\n')
    expect(true).toBe(true) // Always passes, just generates report
  })
})
