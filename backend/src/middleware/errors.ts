import type { Context, Next } from 'hono'
import { AppError } from '../types/errors'
import { apiError } from '../utils/response'

export const errorHandler = () => async (c: Context, next: Next) => {
  try {
    await next()
  } catch (error) {
    if (error instanceof AppError) {
      return c.json(apiError(error.message, error.statusCode, error.details), error.statusCode as any)
    }

    console.error('Unhandled error:', error)
    return c.json(apiError('Internal server error', 500), 500)
  }
}
