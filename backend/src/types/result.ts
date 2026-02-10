/**
 * @fileoverview Result type pattern for explicit error handling.
 * 
 * Instead of throwing exceptions, operations can return a Result<T, E>
 * that explicitly represents success or failure.
 * 
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, 'DIVISION_BY_ZERO'> {
 *   if (b === 0) {
 *     return err('DIVISION_BY_ZERO', 'Cannot divide by zero')
 *   }
 *   return ok(a / b)
 * }
 * 
 * const result = divide(10, 2)
 * if (result.ok) {
 *   console.log(result.value) // 5
 * } else {
 *   console.error(result.error) // { code: 'DIVISION_BY_ZERO', message: '...' }
 * }
 * ```
 */

// ============================================
// Core Result Types
// ============================================

/**
 * Success result containing a value.
 */
export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

/**
 * Failure result containing an error.
 */
export interface Err<E extends string> {
  readonly ok: false
  readonly error: ResultError<E>
}

/**
 * Error structure with code and message.
 */
export interface ResultError<E extends string> {
  readonly code: E
  readonly message: string
  readonly details?: Record<string, unknown> | undefined
}

/**
 * Result type: either Ok<T> or Err<E>.
 */
export type Result<T, E extends string = string> = Ok<T> | Err<E>

// ============================================
// Result Constructors
// ============================================

/**
 * Create a success result.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

/**
 * Create a failure result.
 */
export function err<E extends string>(
  code: E,
  message: string,
  details?: Record<string, unknown>
): Err<E> {
  const error: ResultError<E> = details 
    ? { code, message, details } 
    : { code, message }
  return { ok: false, error }
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if a result is Ok.
 */
export function isOk<T, E extends string>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true
}

/**
 * Check if a result is Err.
 */
export function isErr<T, E extends string>(result: Result<T, E>): result is Err<E> {
  return result.ok === false
}

// ============================================
// Result Utilities
// ============================================

/**
 * Unwrap a result, throwing if it's an error.
 */
export function unwrap<T, E extends string>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value
  }
  throw new Error(`Unwrap failed: [${result.error.code}] ${result.error.message}`)
}

/**
 * Unwrap a result with a default value for errors.
 */
export function unwrapOr<T, E extends string>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value
  }
  return defaultValue
}

/**
 * Map over the success value of a result.
 */
export function map<T, U, E extends string>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value))
  }
  // Explicitly create a new Err to satisfy type inference
  return { ok: false, error: result.error }
}

/**
 * Map over the error of a result.
 */
export function mapErr<T, E extends string, F extends string>(
  result: Result<T, E>,
  fn: (error: ResultError<E>) => ResultError<F>
): Result<T, F> {
  if (isOk(result)) {
    return result
  }
  return { ok: false, error: fn(result.error) }
}

/**
 * Chain (flatMap) results.
 */
export function flatMap<T, U, E extends string>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value)
  }
  // Explicitly create a new Err to satisfy type inference
  return { ok: false, error: result.error }
}

/**
 * Combine multiple results into a single result.
 * Returns the first error encountered, or an array of values.
 */
export function combine<T, E extends string>(
  results: readonly Result<T, E>[]
): Result<T[], E> {
  const values: T[] = []
  
  for (const result of results) {
    if (isErr(result)) {
      return { ok: false, error: result.error }
    }
    values.push(result.value)
  }
  
  return ok(values)
}

/**
 * Execute a function and wrap the result.
 * Catches exceptions and converts them to Err.
 */
export function tryCatch<T>(
  fn: () => T,
  errorCode = 'UNEXPECTED_ERROR' as const
): Result<T, typeof errorCode> {
  try {
    return ok(fn())
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(errorCode, message)
  }
}

/**
 * Execute an async function and wrap the result.
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  errorCode = 'UNEXPECTED_ERROR' as const
): Promise<Result<T, typeof errorCode>> {
  try {
    return ok(await fn())
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(errorCode, message)
  }
}

// ============================================
// Common Error Codes
// ============================================

/** Standard operation error codes */
export type OperationErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'DATABASE_ERROR'
  | 'UNEXPECTED_ERROR'

/** Result type with standard error codes */
export type OperationResult<T> = Result<T, OperationErrorCode>
