/**
 * @fileoverview Custom error classes with standardized error codes.
 * All API errors extend AppError for consistent handling.
 */

/** Standard error codes for API responses */
export const ErrorCodes = {
  // 400 Bad Request
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MALFORMED_REQUEST: 'MALFORMED_REQUEST',
  
  // 401 Unauthorized
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // 403 Forbidden
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ROLE_REQUIRED: 'ROLE_REQUIRED',
  
  // 404 Not Found
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  
  // 409 Conflict
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  
  // 422 Unprocessable Entity
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  
  // 429 Too Many Requests
  RATE_LIMITED: 'RATE_LIMITED',
  
  // 500 Internal Server Error
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export class AppError extends Error {
  public readonly isOperational: boolean = true

  constructor(
    public override readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convert error to JSON response format
   */
  toJSON(): { message: string; code: ErrorCode; statusCode: number; details?: Record<string, unknown> } {
    return {
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    }
  }
}

/**
 * Validation error for invalid input data.
 */
export class ValidationError extends AppError {
  constructor(
    field: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Validation failed for '${field}': ${message}`,
      400,
      ErrorCodes.VALIDATION_FAILED,
      { field, ...details }
    )
  }
}

/**
 * Resource not found error.
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string = 'Resource',
    identifier?: string | number
  ) {
    super(
      identifier
        ? `${resource} with id '${identifier}' not found`
        : `${resource} not found`,
      404,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { resource, ...(identifier !== undefined && { identifier }) }
    )
  }
}

/**
 * Authentication required error.
 */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: ErrorCode = ErrorCodes.AUTH_REQUIRED
  ) {
    super(message, 401, code)
  }
}

/**
 * Permission denied error.
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = 'Insufficient permissions',
    requiredRoles?: string[]
  ) {
    super(
      message,
      403,
      ErrorCodes.PERMISSION_DENIED,
      requiredRoles ? { requiredRoles } : undefined
    )
  }
}

/**
 * Resource already exists error.
 */
export class ConflictError extends AppError {
  constructor(
    resource: string,
    field: string,
    value?: string
  ) {
    super(
      `${resource} with ${field}${value ? ` '${value}'` : ''} already exists`,
      409,
      ErrorCodes.RESOURCE_EXISTS,
      { resource, field, ...(value && { value }) }
    )
  }
}

/**
 * Business rule violation error.
 */
export class BusinessRuleError extends AppError {
  constructor(
    rule: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, 422, ErrorCodes.BUSINESS_RULE_VIOLATION, { rule, ...details })
  }
}

/**
 * Rate limiting error.
 */
export class RateLimitError extends AppError {
  constructor(
    retryAfterSeconds?: number
  ) {
    super(
      'Too many requests, please try again later',
      429,
      ErrorCodes.RATE_LIMITED,
      retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined
    )
  }
}

/**
 * Database error wrapper.
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = 'A database error occurred',
    originalError?: Error
  ) {
    super(
      message,
      500,
      ErrorCodes.DATABASE_ERROR,
      originalError ? { originalMessage: originalError.message } : undefined
    )
  }
}

/**
 * Check if an error is an operational AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational
}

/**
 * Wrap unknown errors into AppError.
 */
export function wrapError(error: unknown, defaultMessage: string = 'An unexpected error occurred'): AppError {
  if (isAppError(error)) return error
  if (error instanceof Error) {
    return new AppError(error.message || defaultMessage, 500, ErrorCodes.INTERNAL_ERROR)
  }
  return new AppError(defaultMessage, 500, ErrorCodes.INTERNAL_ERROR)
}
