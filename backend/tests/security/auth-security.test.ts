/**
 * @fileoverview Security tests for authentication system.
 * Tests refresh token rotation, session management, and security features.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Hono } from 'hono'
import { auth } from '../../src/routes/auth'
import { appRequest, createTestUser, cleanupTestUsers } from '../helpers'

describe('Auth Security', () => {
  const app = new Hono()
  app.route('/api/auth', auth)

  const testUser = {
    email: 'security-test@example.com',
    password: 'SecurePass123!',
    fullName: 'Security Test User',
  }

  beforeAll(async () => {
    await cleanupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe('Password Policy', () => {
    test('should reject password without uppercase', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/register', {
        ...testUser,
        email: 'weak1@test.com',
        password: 'nouppercasepass1!',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('uppercase')
    })

    test('should reject password without lowercase', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/register', {
        ...testUser,
        email: 'weak2@test.com',
        password: 'NOLOWERCASEPASS1!',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('lowercase')
    })

    test('should reject password without number', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/register', {
        ...testUser,
        email: 'weak3@test.com',
        password: 'NoNumberPass!',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('number')
    })

    test('should reject password shorter than 8 characters', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/register', {
        ...testUser,
        email: 'weak4@test.com',
        password: 'Short1!',
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('8 characters')
    })

    test('should accept strong password', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/register', {
        ...testUser,
        email: 'strong@test.com',
        password: 'StrongPass123',
      })
      expect(res.status).toBe(201)
    })
  })

  describe('Refresh Token Flow', () => {
    let accessToken: string
    let refreshToken: string

    test('login should return access and refresh tokens', async () => {
      // First register
      await appRequest(app, 'POST', '/api/auth/register', testUser)

      // Then login
      const res = await appRequest(app, 'POST', '/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      
      expect(body.data.accessToken).toBeDefined()
      expect(body.data.expiresIn).toBeGreaterThan(0)
      
      // Check for refresh token in Set-Cookie header
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('refresh_token=')
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('Secure')
      expect(setCookie).toContain('SameSite=Strict')

      accessToken = body.data.accessToken
      // Extract refresh token from cookie for testing
      const match = setCookie?.match(/refresh_token=([^;]+)/)
      refreshToken = match?.[1] || ''
    })

    test('refresh should return new tokens', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/refresh', {
        refreshToken,
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      
      expect(body.data.accessToken).toBeDefined()
      expect(body.data.accessToken).not.toBe(accessToken) // New token
      
      // New refresh token should be set
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('refresh_token=')
    })

    test('should reject used refresh token (rotation)', async () => {
      // Try to use the old refresh token again
      const res = await appRequest(app, 'POST', '/api/auth/refresh', {
        refreshToken,
      })

      expect(res.status).toBe(401)
    })

    test('should reject invalid refresh token', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/refresh', {
        refreshToken: 'invalid-token-here',
      })

      expect(res.status).toBe(401)
    })
  })

  describe('Session Management', () => {
    let accessToken: string
    let refreshToken: string

    beforeAll(async () => {
      // Login to get tokens
      const res = await appRequest(app, 'POST', '/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      })
      const body = await res.json()
      accessToken = body.data.accessToken
      const match = res.headers.get('set-cookie')?.match(/refresh_token=([^;]+)/)
      refreshToken = match?.[1] || ''
    })

    test('logout should revoke refresh token', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/logout', {
        refreshToken,
      })

      expect(res.status).toBe(200)

      // Check cookie is cleared
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('Max-Age=0')
    })

    test('should not be able to refresh after logout', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/refresh', {
        refreshToken,
      })

      expect(res.status).toBe(401)
    })
  })

  describe('Rate Limiting', () => {
    test('should rate limit login attempts', async () => {
      const attempts = Array(10).fill(null)
      
      for (const _ of attempts) {
        await appRequest(app, 'POST', '/api/auth/login', {
          email: 'ratelimit@test.com',
          password: 'wrong',
        })
      }

      // 11th attempt should be rate limited
      const res = await appRequest(app, 'POST', '/api/auth/login', {
        email: 'ratelimit@test.com',
        password: 'wrong',
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('retry-after')).toBeDefined()
    })
  })

  describe('Security Headers', () => {
    test('should include security headers in response', async () => {
      const res = await appRequest(app, 'POST', '/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      })

      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('x-frame-options')).toBe('DENY')
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    })
  })
})
