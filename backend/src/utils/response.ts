/**
 * @fileoverview Standardized API response utilities.
 * 
 * @description
 * All API responses follow a consistent format:
 * - Success: { success: true, data: T, meta?: {...} }
 * - Error: { success: false, error: { message, code, statusCode, details? } }
 */

import type { ApiResponseBody, ApiErrorBody, PaginationMeta } from '../types'
import type { ErrorCode } from '../types/errors'
import { ErrorCodes } from '../types/errors'

/**
 * Response metadata options.
 */
interface ResponseMeta {
  pagination?: PaginationMeta
  requestId?: string
  timestamp?: string
  [key: string]: unknown
}

/**
 * Create a successful API response.
 * 
 * @param data - The response data
 * @param meta - Optional metadata (pagination, requestId, etc.)
 * @returns Formatted success response
 * 
 * @example
 * ```typescript
 * return c.json(apiResponse(users, { pagination }))
 * ```
 */
export function apiResponse<T>(
  data: T,
  meta?: ResponseMeta
): ApiResponseBody<T> {
  const response: ApiResponseBody<T> = {
    success: true,
    data,
  }

  if (meta && Object.keys(meta).length > 0) {
    response.meta = {
      ...meta,
      timestamp: new Date().toISOString(),
    }
  }

  return response
}

/**
 * Create an error API response.
 * 
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code
 * @param code - Machine-readable error code (e.g., 'VALIDATION_FAILED')
 * @param details - Additional error details
 * @returns Formatted error response
 * 
 * @example
 * ```typescript
 * return c.json(apiError('User not found', 404, ErrorCodes.USER_NOT_FOUND), 404)
 * ```
 */
export function apiError(
  message: string,
  statusCode: number = 500,
  code: ErrorCode | string = ErrorCodes.INTERNAL_ERROR,
  details?: Record<string, unknown>
): ApiErrorBody {
  return {
    success: false,
    error: {
      message,
      code: code as string,
      statusCode,
      ...(details !== undefined && Object.keys(details).length > 0 ? { details } : {}),
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Create a validation error response.
 * 
 * @param field - The field that failed validation
 * @param message - Validation error message
 * @param details - Additional validation details
 */
export function validationError(
  field: string,
  message: string,
  details?: Record<string, unknown>
): ApiErrorBody {
  return apiError(
    `Validation failed for '${field}': ${message}`,
    400,
    ErrorCodes.VALIDATION_FAILED,
    { field, ...details }
  )
}

/**
 * Create a not found error response.
 * 
 * @param resource - The resource type (e.g., 'User', 'Property')
 * @param id - Optional resource identifier
 */
export function notFoundError(
  resource: string,
  id?: string | number
): ApiErrorBody {
  const message = id 
    ? `${resource} with id '${id}' not found`
    : `${resource} not found`
  
  return apiError(message, 404, ErrorCodes.RESOURCE_NOT_FOUND, { resource, id })
}

/**
 * Create an unauthorized error response.
 */
export function unauthorizedError(message: string = 'Authentication required'): ApiErrorBody {
  return apiError(message, 401, ErrorCodes.AUTH_REQUIRED)
}

/**
 * Create a forbidden error response.
 */
export function forbiddenError(message: string = 'Insufficient permissions'): ApiErrorBody {
  return apiError(message, 403, ErrorCodes.PERMISSION_DENIED)
}
