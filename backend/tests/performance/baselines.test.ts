import { describe, test, expect } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { appRequest, measureTime } from '../helpers'
import { hashPassword, signJWT, verifyJWT, generateSecureToken } from '../../src/utils/crypto'
import { apiResponse } from '../../src/utils/response'

describe('Performance Baselines', () => {
  describe('Response times', () => {
    const app = new Hono()
    app.get('/fast', (c) => c.json(apiResponse({ ok: true })))
    app.get('/json-large', (c) => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        title: `Property ${i}`,
        city: 'Madrid',
        price: (i * 1000).toString(),
      }))
      return c.json(apiResponse(items))
    })

    test('simple JSON response should be < 5ms', async () => {
      const { durationMs } = await measureTime(() => appRequest(app, 'GET', '/fast'))
      expect(durationMs).toBeLessThan(5)
    })

    test('100-item JSON response should be < 10ms', async () => {
      const { durationMs } = await measureTime(() => appRequest(app, 'GET', '/json-large'))
      expect(durationMs).toBeLessThan(10)
    })

    test('should handle 100 sequential requests < 200ms', async () => {
      const { durationMs } = await measureTime(async () => {
        for (let i = 0; i < 100; i++) {
          await appRequest(app, 'GET', '/fast')
        }
      })
      expect(durationMs).toBeLessThan(200)
    })
  })

  describe('Crypto performance', () => {
    test('JWT sign should be < 1ms', async () => {
      const { durationMs } = await measureTime(async () => {
        signJWT({ userId: 1, role: 'admin' })
      })
      expect(durationMs).toBeLessThan(1)
    })

    test('JWT verify should be < 1ms', async () => {
      const token = signJWT({ userId: 1 })
      const { durationMs } = await measureTime(async () => {
        verifyJWT(token)
      })
      expect(durationMs).toBeLessThan(1)
    })

    test('password hash should be < 500ms', async () => {
      const { durationMs } = await measureTime(() => hashPassword('testpassword'))
      expect(durationMs).toBeLessThan(500)
    })

    test('secure token generation should be < 1ms', async () => {
      const { durationMs } = await measureTime(async () => {
        generateSecureToken(64)
      })
      expect(durationMs).toBeLessThan(1)
    })
  })

  describe('Memory usage', () => {
    test('should not leak memory on 1000 response generations', () => {
      const before = process.memoryUsage().heapUsed
      for (let i = 0; i < 1000; i++) {
        apiResponse({ id: i, data: 'x'.repeat(100) })
      }
      const after = process.memoryUsage().heapUsed
      const increase = (after - before) / 1024 / 1024 // MB
      // Allow up to 5MB increase for 1000 response objects
      expect(increase).toBeLessThan(5)
    })
  })
})
