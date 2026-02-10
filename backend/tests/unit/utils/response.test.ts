import { describe, test, expect } from 'bun:test'
import { apiResponse, apiError } from '../../../src/utils/response'
import { ErrorCodes } from '../../../src/types/errors'

describe('response utils', () => {
  describe('apiResponse', () => {
    test('should create success response with data', () => {
      const result = apiResponse({ id: 1, name: 'Test' })
      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
      })
    })

    test('should include meta when provided', () => {
      const pagination = { page: 1, limit: 10, total: 50, pages: 5 }
      const result = apiResponse([1, 2, 3], { pagination })
      expect(result.success).toBe(true)
      expect(result.meta?.pagination).toEqual(pagination)
    })

    test('should handle null data', () => {
      const result = apiResponse(null)
      expect(result).toEqual({ success: true, data: null })
    })

    test('should handle array data', () => {
      const result = apiResponse([1, 2, 3])
      expect(result.data).toEqual([1, 2, 3])
    })
  })

  describe('apiError', () => {
    test('should create error response with defaults', () => {
      const result = apiError('Something failed')
      expect(result.success).toBe(false)
      expect(result.error.message).toBe('Something failed')
      expect(result.error.statusCode).toBe(500)
      expect(result.error.code).toBe(ErrorCodes.INTERNAL_ERROR)
      expect(result.error.timestamp).toBeDefined()
    })

    test('should use provided statusCode and code', () => {
      const result = apiError('Not found', 404, ErrorCodes.RESOURCE_NOT_FOUND)
      expect(result.error.statusCode).toBe(404)
      expect(result.error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND)
    })

    test('should include details when provided', () => {
      const details = { field: 'email', reason: 'required' }
      const result = apiError('Validation', 400, ErrorCodes.VALIDATION_FAILED, details)
      expect(result.error.details).toEqual(details)
    })

    test('should not include details when undefined', () => {
      const result = apiError('Error', 500)
      expect('details' in result.error).toBe(false)
    })
  })
})
