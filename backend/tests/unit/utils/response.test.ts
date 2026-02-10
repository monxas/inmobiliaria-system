import { describe, test, expect } from 'bun:test'
import { apiResponse, apiError } from '../../../src/utils/response'

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
      expect(result).toEqual({
        success: false,
        error: { message: 'Something failed', code: 500 },
      })
    })

    test('should use provided code', () => {
      const result = apiError('Not found', 404)
      expect(result.error.code).toBe(404)
    })

    test('should include details when provided', () => {
      const details = [{ field: 'email', message: 'required' }]
      const result = apiError('Validation', 400, details)
      expect(result.error.details).toEqual(details)
    })

    test('should not include details when undefined', () => {
      const result = apiError('Error', 500)
      expect('details' in result.error).toBe(false)
    })
  })
})
