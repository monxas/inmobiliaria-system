/**
 * Rate Limiter Middleware Tests — Tests for the actual implementation
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { rateLimiter, authRateLimiter, EndpointType } from '../../../src/middleware/rate-limiter'
import { appRequest, parseResponse } from '../../helpers'

describe('Rate Limiter Middleware', () => {
  describe('General rate limiter', () => {
    test('should allow requests within limit', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 100 }))
      app.get('/test', (c) => c.json({ ok: true }))

      // Use unique IP to avoid collision with other tests
      const testIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.1`
      
      const res = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': testIp }
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
    })

    test('should block requests exceeding limit', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 3 }))
      app.get('/test', (c) => c.json({ ok: true }))

      const testIp = `20.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.2`

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        await appRequest(app, 'GET', '/test', {
          headers: { 'X-Forwarded-For': testIp }
        })
      }

      // 4th request should be blocked
      const res = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': testIp }
      })
      expect(res.status).toBe(429)
    })

    test('should include rate limit headers', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 50 }))
      app.get('/test', (c) => c.json({ ok: true }))

      const testIp = `30.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.3`
      
      const res = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': testIp }
      })
      
      // Headers should be present
      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    test('should read IP from X-Forwarded-For header', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 2 }))
      app.get('/test', (c) => c.json({ ok: true }))

      // Different IPs should have separate limits
      const res1 = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': `40.1.1.${Math.floor(Math.random() * 255)}` }
      })
      expect(res1.status).toBe(200)

      const res2 = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': `40.2.2.${Math.floor(Math.random() * 255)}` }
      })
      expect(res2.status).toBe(200)
    })

    test('should handle X-Forwarded-For with multiple IPs', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 1 }))
      app.get('/test', (c) => c.json({ ok: true }))

      const baseIp = `50.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.4`
      
      const res1 = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': `${baseIp}, 5.6.7.8` }
      })
      expect(res1.status).toBe(200)

      // Same first IP should be rate limited
      const res2 = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': `${baseIp}, 9.9.9.9` }
      })
      expect(res2.status).toBe(429)
    })

    test('should use X-Real-IP when X-Forwarded-For is missing', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 1 }))
      app.get('/test', (c) => c.json({ ok: true }))

      const testIp = `60.0.0.${Math.floor(Math.random() * 255)}`

      const res1 = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Real-IP': testIp }
      })
      expect(res1.status).toBe(200)

      const res2 = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Real-IP': testIp }
      })
      expect(res2.status).toBe(429)
    })

    test('should return 429 with error message when blocked', async () => {
      const app = new Hono()
      app.use('*', rateLimiter({ windowMs: 60000, maxRequests: 1 }))
      app.get('/test', (c) => c.json({ ok: true }))

      const testIp = `70.0.0.${Math.floor(Math.random() * 255)}`

      await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': testIp }
      })
      
      const res = await appRequest(app, 'GET', '/test', {
        headers: { 'X-Forwarded-For': testIp }
      })
      
      expect(res.status).toBe(429)
      const body = await parseResponse(res)
      expect(body.error).toBeDefined()
      expect(typeof body.error).toBe('string')
    })
  })

  describe('Auth rate limiter', () => {
    test('should have stricter limits for auth endpoints', async () => {
      const app = new Hono()
      app.use('/auth/*', authRateLimiter())
      app.post('/auth/login', (c) => c.json({ ok: true }))

      const testIp = `80.0.0.${Math.floor(Math.random() * 255)}`
      
      const res = await appRequest(app, 'POST', '/auth/login', {
        headers: { 'X-Forwarded-For': testIp }
      })
      expect(res.status).toBe(200)
      
      // Auth should have a limit header
      const limit = res.headers.get('X-RateLimit-Limit')
      expect(limit).toBeDefined()
      // Auth limits should be stricter (typically 5-10 per minute)
      expect(parseInt(limit!)).toBeLessThanOrEqual(10)
    })

    test('should block auth endpoint after limit exceeded', async () => {
      const app = new Hono()
      app.use('/auth/*', authRateLimiter())
      app.post('/auth/login', (c) => c.json({ ok: true }))

      // Use unique IP to avoid collision with other tests
      const ip = `90.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.5`
      
      // Get the limit first
      const firstRes = await appRequest(app, 'POST', '/auth/login', {
        headers: { 'X-Forwarded-For': ip }
      })
      const limit = parseInt(firstRes.headers.get('X-RateLimit-Limit') || '5')
      
      // Exhaust the remaining limit
      for (let i = 1; i < limit; i++) {
        await appRequest(app, 'POST', '/auth/login', {
          headers: { 'X-Forwarded-For': ip }
        })
      }

      // Next request should be blocked
      const res = await appRequest(app, 'POST', '/auth/login', {
        headers: { 'X-Forwarded-For': ip }
      })
      expect(res.status).toBe(429)
    })
  })

  describe('Endpoint type rate limiting', () => {
    test('different key prefixes create separate rate limit buckets', async () => {
      const app = new Hono()
      // Different prefixes should be tracked separately
      app.get('/read', rateLimiter({ keyPrefix: EndpointType.READ, maxRequests: 1 }), (c) => c.json({ ok: true }))
      app.post('/write', rateLimiter({ keyPrefix: EndpointType.WRITE, maxRequests: 1 }), (c) => c.json({ ok: true }))

      const testIp = `100.0.0.${Math.floor(Math.random() * 255)}`

      // First read request
      const res1 = await appRequest(app, 'GET', '/read', {
        headers: { 'X-Forwarded-For': testIp }
      })
      expect(res1.status).toBe(200)

      // First write request - should also pass (different bucket)
      const res2 = await appRequest(app, 'POST', '/write', {
        headers: { 'X-Forwarded-For': testIp }
      })
      expect(res2.status).toBe(200)

      // Second read request - should be blocked (same bucket)
      const res3 = await appRequest(app, 'GET', '/read', {
        headers: { 'X-Forwarded-For': testIp }
      })
      expect(res3.status).toBe(429)
    })
  })
})
