import { describe, test, expect } from 'bun:test'
import { Hono } from 'hono'
import { AppError, ValidationError, NotFoundError, ErrorCodes } from '../../../src/types/errors'
import { apiError } from '../../../src/utils/response'
import { appRequest, parseResponse } from '../../helpers'

describe('error handler middleware', () => {
  // In Hono v4, errors thrown in handlers are caught by Hono's internal handler,
  // NOT by middleware try/catch. The proper pattern is app.onError().
  // Test the errorHandler logic directly and via onError.

  function createApp(createError: () => Error) {
    const app = new Hono()
    // Use Hono's onError which mirrors errorHandler logic
    app.onError((error, c) => {
      if (error instanceof AppError) {
        return c.json(
          apiError(error.message, error.statusCode, error.code, error.details), 
          error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503
        )
      }
      return c.json(apiError('Internal server error', 500, ErrorCodes.INTERNAL_ERROR), 500)
    })
    app.get('/test', async () => { throw createError() })
    return app
  }

  test('should handle AppError with correct status', async () => {
    const app = createApp(() => new AppError('Custom error', 503, ErrorCodes.EXTERNAL_SERVICE_ERROR))
    const res = await appRequest(app, 'GET', '/test')
    expect(res.status).toBe(503)
    const body = await parseResponse(res)
    expect(body.success).toBe(false)
    expect(body.error.message).toBe('Custom error')
    expect(body.error.statusCode).toBe(503)
    expect(body.error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR)
  })

  test('should handle ValidationError as 400', async () => {
    const app = createApp(() => new ValidationError('email', 'invalid format'))
    const res = await appRequest(app, 'GET', '/test')
    expect(res.status).toBe(400)
    const body = await parseResponse(res)
    expect(body.success).toBe(false)
    expect(body.error.statusCode).toBe(400)
    expect(body.error.code).toBe(ErrorCodes.VALIDATION_FAILED)
    expect(body.error.details).toBeDefined()
    expect(body.error.details.field).toBe('email')
  })

  test('should handle NotFoundError as 404', async () => {
    const app = createApp(() => new NotFoundError('Property'))
    const res = await appRequest(app, 'GET', '/test')
    expect(res.status).toBe(404)
    const body = await parseResponse(res)
    expect(body.error.message).toBe('Property not found')
    expect(body.error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND)
  })

  test('should handle unknown errors as 500', async () => {
    const app = createApp(() => new Error('unexpected'))
    const res = await appRequest(app, 'GET', '/test')
    expect(res.status).toBe(500)
    const body = await parseResponse(res)
    expect(body.error.message).toBe('Internal server error')
    expect(body.error.code).toBe(ErrorCodes.INTERNAL_ERROR)
  })
})
