/**
 * @fileoverview Tests for granular rate limiting.
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import {
  rateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  writeRateLimiter,
  getRateLimiterStats,
} from '../../src/middleware/rate-limiter'

describe('Rate Limiter', () => {
  describe('General Rate Limiter', () => {
    let app: Hono

    beforeEach(() => {
      app = new Hono()
      app.use('*', rateLimiter({ windowMs: 1000, maxRequests: 5, keyPrefix: 'test' }))
      app.get('/test', (c) => c.json({ ok: true }))
    })

    test('should allow requests under limit', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/test', {
          headers: { 'x-forwarded-for': '10.0.0.1' },
        })
        expect(res.status).toBe(200)
      }
    })

    test('should block requests over limit', async () => {
      // Make 5 allowed requests
      for (let i = 0; i < 5; i++) {
        await app.request('/test', {
          headers: { 'x-forwarded-for': '10.0.0.2' },
        })
      }

      // 6th request should be blocked
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.2' },
      })
      expect(res.status).toBe(429)
    })

    test('should include rate limit headers', async () => {
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.3' },
      })

      expect(res.headers.get('x-ratelimit-limit')).toBe('5')
      expect(res.headers.get('x-ratelimit-remaining')).toBe('4')
      expect(res.headers.get('x-ratelimit-reset')).toBeTruthy()
    })

    test('should track different IPs separately', async () => {
      // Exhaust limit for IP1
      for (let i = 0; i < 6; i++) {
        await app.request('/test', {
          headers: { 'x-forwarded-for': '10.0.0.4' },
        })
      }

      // IP2 should still be allowed
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.5' },
      })
      expect(res.status).toBe(200)
    })

    test('should include Retry-After header when blocked', async () => {
      for (let i = 0; i < 6; i++) {
        await app.request('/test', {
          headers: { 'x-forwarded-for': '10.0.0.6' },
        })
      }

      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.6' },
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('retry-after')).toBeTruthy()
    })
  })

  describe('Auth Rate Limiter', () => {
    let app: Hono

    beforeEach(() => {
      app = new Hono()
      app.use('*', authRateLimiter())
      app.post('/login', (c) => c.json({ ok: true }))
    })

    test('should have stricter limits for auth', async () => {
      // Auth limiter defaults to 5 requests per minute
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/login', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.0.1.1' },
        })
        expect(res.status).toBe(200)
      }

      // 6th should be blocked
      const res = await app.request('/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.1.1' },
      })
      expect(res.status).toBe(429)
      expect(await res.json()).toHaveProperty('error')
    })
  })

  describe('Upload Rate Limiter', () => {
    let app: Hono

    beforeEach(() => {
      app = new Hono()
      app.use('*', uploadRateLimiter())
      app.post('/upload', (c) => c.json({ ok: true }))
    })

    test('should apply upload-specific limits', async () => {
      // Upload limiter: 10 per minute
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/upload', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.0.2.1' },
        })
        expect(res.status).toBe(200)
      }

      // 11th should be blocked
      const res = await app.request('/upload', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.2.1' },
      })
      expect(res.status).toBe(429)
    })
  })

  describe('Write Rate Limiter', () => {
    let app: Hono

    beforeEach(() => {
      app = new Hono()
      app.use('*', writeRateLimiter())
      app.post('/resource', (c) => c.json({ ok: true }))
    })

    test('should apply write-specific limits', async () => {
      // Write limiter: 30 per minute
      for (let i = 0; i < 30; i++) {
        const res = await app.request('/resource', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.0.3.1' },
        })
        expect(res.status).toBe(200)
      }

      // 31st should be blocked
      const res = await app.request('/resource', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.3.1' },
      })
      expect(res.status).toBe(429)
    })
  })

  describe('IP Detection', () => {
    let app: Hono

    beforeEach(() => {
      app = new Hono()
      app.use('*', rateLimiter({ windowMs: 1000, maxRequests: 2, keyPrefix: 'ip-test' }))
      app.get('/test', (c) => c.json({ ok: true }))
    })

    test('should use x-forwarded-for header', async () => {
      for (let i = 0; i < 3; i++) {
        await app.request('/test', {
          headers: { 'x-forwarded-for': '1.2.3.4' },
        })
      }

      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })
      expect(res.status).toBe(429)
    })

    test('should use first IP from x-forwarded-for chain', async () => {
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '1.2.3.5, 10.0.0.1, 10.0.0.2' },
      })
      expect(res.status).toBe(200)
    })

    test('should fallback to x-real-ip', async () => {
      for (let i = 0; i < 3; i++) {
        await app.request('/test', {
          headers: { 'x-real-ip': '5.6.7.8' },
        })
      }

      const res = await app.request('/test', {
        headers: { 'x-real-ip': '5.6.7.8' },
      })
      expect(res.status).toBe(429)
    })

    test('should support Cloudflare header', async () => {
      const res = await app.request('/test', {
        headers: { 'cf-connecting-ip': '9.10.11.12' },
      })
      expect(res.status).toBe(200)
    })
  })

  describe('Stats', () => {
    test('should provide rate limiter stats', () => {
      const stats = getRateLimiterStats()
      expect(stats).toHaveProperty('entries')
      expect(stats).toHaveProperty('violations')
      expect(typeof stats.entries).toBe('number')
      expect(typeof stats.violations).toBe('number')
    })
  })
})
