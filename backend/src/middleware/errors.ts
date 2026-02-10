import type { Context, Next } from 'hono'
import { AppError, ErrorCodes } from '../types/errors'
import { apiError } from '../utils/response'
import { logger } from '../lib/logger'

const log = logger.child({ middleware: 'error-handler' })

export const errorHandler = () => async (c: Context, next: Next): Promise<Response | void> => {
  try {
    await next()
  } catch (error) {
    const requestId = c.get('requestId') as string | undefined

    if (error instanceof AppError) {
      // Log only server errors
      if (error.statusCode >= 500) {
        log.error('Application error', {
          message: error.message,
          statusCode: error.statusCode,
          requestId,
          stack: error.stack,
        })
      }
      return c.json(
        apiError(error.message, error.statusCode, error.code, error.details),
        error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500
      )
    }

    // Log unhandled errors
    log.error('Unhandled error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
      path: c.req.path,
      method: c.req.method,
    })

    return c.json(apiError('Internal server error', 500, ErrorCodes.INTERNAL_ERROR), 500)
  }
}
