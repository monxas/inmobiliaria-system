import type { Context, Next } from 'hono'
import { z } from 'zod'
import { apiError } from '../utils/response'

export const validateBody = <T extends z.ZodSchema>(schema: T) =>
  async (c: Context, next: Next) => {
    try {
      const body = await c.req.json()
      const parsed = schema.parse(body)
      c.set('validatedBody', parsed)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          apiError('Validation failed', 400, error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))),
          400
        )
      }
      return c.json(apiError('Invalid request body', 400), 400)
    }
  }

export const validateQuery = <T extends z.ZodSchema>(schema: T) =>
  async (c: Context, next: Next) => {
    try {
      const query = c.req.query()
      const parsed = schema.parse(query)
      c.set('validatedQuery', parsed)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          apiError('Invalid query parameters', 400, error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))),
          400
        )
      }
      return c.json(apiError('Invalid query parameters', 400), 400)
    }
  }
