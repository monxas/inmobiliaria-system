import { describe, test, expect } from 'bun:test'
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '../../../src/types/errors'

describe('Error classes', () => {
  test('AppError has correct properties', () => {
    const err = new AppError('test error', 503, { extra: true })
    expect(err.message).toBe('test error')
    expect(err.statusCode).toBe(503)
    expect(err.details).toEqual({ extra: true })
    expect(err.name).toBe('AppError')
    expect(err instanceof Error).toBe(true)
  })

  test('AppError defaults to 500', () => {
    const err = new AppError('oops')
    expect(err.statusCode).toBe(500)
  })

  test('ValidationError', () => {
    const err = new ValidationError('email', 'is required')
    expect(err.statusCode).toBe(400)
    expect(err.field).toBe('email')
    expect(err.message).toContain('email')
    expect(err.message).toContain('is required')
    expect(err.name).toBe('ValidationError')
    expect(err instanceof AppError).toBe(true)
  })

  test('NotFoundError', () => {
    const err = new NotFoundError('Property')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Property not found')

    const defaultErr = new NotFoundError()
    expect(defaultErr.message).toBe('Resource not found')
  })

  test('UnauthorizedError', () => {
    const err = new UnauthorizedError()
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Authentication required')

    const custom = new UnauthorizedError('Token expired')
    expect(custom.message).toBe('Token expired')
  })

  test('ForbiddenError', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('Insufficient permissions')
  })
})
