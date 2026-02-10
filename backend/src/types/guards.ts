/**
 * @fileoverview Type guards and predicates for runtime type checking.
 * 
 * Type guards narrow types at runtime, providing type safety
 * when working with unknown data (e.g., API responses, user input).
 */

import type { 
  UserRole, 
  PropertyType, 
  PropertyStatus, 
  FileCategory,
  AuthUser,
  JWTPayload,
} from './index'

// ============================================
// Primitive Guards
// ============================================

/**
 * Check if value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Check if value is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Check if value is a boolean.
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Check if value is null.
 */
export function isNull(value: unknown): value is null {
  return value === null
}

/**
 * Check if value is undefined.
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined
}

/**
 * Check if value is null or undefined.
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

/**
 * Check if value is not null or undefined.
 */
export function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

// ============================================
// Object Guards
// ============================================

/**
 * Check if value is a plain object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Check if value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Check if value is an array of strings.
 */
export function isStringArray(value: unknown): value is string[] {
  return isArray(value) && value.every(isString)
}

/**
 * Check if value is an array of numbers.
 */
export function isNumberArray(value: unknown): value is number[] {
  return isArray(value) && value.every(isNumber)
}

/**
 * Check if value is a function.
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

/**
 * Check if value is a Date.
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/**
 * Check if value is an Error.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error
}

// ============================================
// Domain Guards
// ============================================

const USER_ROLES: readonly UserRole[] = ['admin', 'agent', 'client'] as const

/**
 * Check if value is a valid UserRole.
 */
export function isUserRole(value: unknown): value is UserRole {
  return isString(value) && (USER_ROLES as readonly string[]).includes(value)
}

const PROPERTY_TYPES: readonly PropertyType[] = [
  'house', 'apartment', 'office', 'warehouse', 'land', 'commercial'
] as const

/**
 * Check if value is a valid PropertyType.
 */
export function isPropertyType(value: unknown): value is PropertyType {
  return isString(value) && (PROPERTY_TYPES as readonly string[]).includes(value)
}

const PROPERTY_STATUSES: readonly PropertyStatus[] = [
  'available', 'reserved', 'sold', 'rented', 'off_market'
] as const

/**
 * Check if value is a valid PropertyStatus.
 */
export function isPropertyStatus(value: unknown): value is PropertyStatus {
  return isString(value) && (PROPERTY_STATUSES as readonly string[]).includes(value)
}

const FILE_CATEGORIES: readonly FileCategory[] = [
  'property_docs', 'property_images', 'client_docs', 'contracts', 'other'
] as const

/**
 * Check if value is a valid FileCategory.
 */
export function isFileCategory(value: unknown): value is FileCategory {
  return isString(value) && (FILE_CATEGORIES as readonly string[]).includes(value)
}

// ============================================
// Auth Guards
// ============================================

/**
 * Check if value is a valid AuthUser.
 */
export function isAuthUser(value: unknown): value is AuthUser {
  if (!isObject(value)) return false
  
  return (
    isNumber(value['id']) &&
    isString(value['email']) &&
    isUserRole(value['role']) &&
    isString(value['fullName'])
  )
}

/**
 * Check if value is a valid JWTPayload.
 */
export function isJWTPayload(value: unknown): value is JWTPayload {
  if (!isObject(value)) return false
  
  return (
    isNumber(value['id']) &&
    isString(value['email']) &&
    isUserRole(value['role']) &&
    isString(value['fullName']) &&
    isNumber(value['iat']) &&
    isNumber(value['exp'])
  )
}

// ============================================
// Validation Guards
// ============================================

/**
 * Check if value is a valid positive integer ID.
 */
export function isPositiveInt(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value > 0
}

/**
 * Check if value is a valid email format.
 */
export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Check if value is a valid phone format.
 */
export function isPhone(value: unknown): value is string {
  if (!isString(value)) return false
  const phoneRegex = /^[\d\s+\-().]+$/
  return phoneRegex.test(value)
}

/**
 * Check if value is a valid URL.
 */
export function isUrl(value: unknown): value is string {
  if (!isString(value)) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

/**
 * Check if value is a valid ISO date string.
 */
export function isISODateString(value: unknown): value is string {
  if (!isString(value)) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && value.includes('T')
}

// ============================================
// Utility Guards
// ============================================

/**
 * Check if object has a property.
 */
export function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is { [P in K]: unknown } {
  return isObject(obj) && key in obj
}

/**
 * Check if object has a property of a specific type.
 */
export function hasTypedProperty<K extends PropertyKey, T>(
  obj: unknown,
  key: K,
  guard: (value: unknown) => value is T
): obj is { [P in K]: T } {
  return hasProperty(obj, key) && guard(obj[key as keyof typeof obj])
}

/**
 * Narrow type or return undefined.
 */
export function narrow<T>(
  value: unknown,
  guard: (value: unknown) => value is T
): T | undefined {
  return guard(value) ? value : undefined
}

/**
 * Assert that a condition is true.
 * @throws Error if condition is false
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

/**
 * Assert that a value is defined.
 * @throws Error if value is null or undefined
 */
export function assertDefined<T>(
  value: T,
  name = 'value'
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`${name} is not defined`)
  }
}

/**
 * Assert that a value matches a guard.
 * @throws Error if guard returns false
 */
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  message: string
): asserts value is T {
  if (!guard(value)) {
    throw new Error(message)
  }
}
