import { describe, test, expect } from 'bun:test'
import { Hono } from 'hono'
import { z } from 'zod'
import { validateBody, validateQuery } from '../../../src/middleware/validation'
import { appRequest, parseResponse } from '../../helpers'

describe('validation middleware', () => {
  describe('validateBody', () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
      age: z.number().int().positive().optional(),
    })

    const app = new Hono()
    app.post('/test', validateBody(schema), (c) => {
      const body = c.get('validatedBody')
      return c.json({ received: body })
    })

    test('should accept valid body', async () => {
      const res = await appRequest(app, 'POST', '/test', {
        body: { email: 'test@test.com', name: 'John' },
      })
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.received.email).toBe('test@test.com')
    })

    test('should reject invalid email', async () => {
      const res = await appRequest(app, 'POST', '/test', {
        body: { email: 'not-email', name: 'John' },
      })
      expect(res.status).toBe(400)
      const body = await parseResponse(res)
      expect(body.error.message).toBe('Validation failed')
      expect(body.error.details).toBeArray()
      expect(body.error.details[0].field).toBe('email')
    })

    test('should reject missing required fields', async () => {
      const res = await appRequest(app, 'POST', '/test', {
        body: { email: 'test@test.com' },
      })
      expect(res.status).toBe(400)
    })

    test('should accept optional fields', async () => {
      const res = await appRequest(app, 'POST', '/test', {
        body: { email: 'test@test.com', name: 'John', age: 25 },
      })
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.received.age).toBe(25)
    })
  })

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.string().regex(/^\d+$/).optional(),
      search: z.string().optional(),
    })

    const app = new Hono()
    app.get('/test', validateQuery(schema), (c) => {
      const query = c.get('validatedQuery')
      return c.json({ received: query })
    })

    test('should accept valid query params', async () => {
      const res = await appRequest(app, 'GET', '/test?page=1&search=hello')
      expect(res.status).toBe(200)
      const body = await parseResponse(res)
      expect(body.received.page).toBe('1')
      expect(body.received.search).toBe('hello')
    })

    test('should reject invalid query params', async () => {
      const res = await appRequest(app, 'GET', '/test?page=abc')
      expect(res.status).toBe(400)
    })
  })
})
