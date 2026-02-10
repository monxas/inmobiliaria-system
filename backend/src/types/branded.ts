/**
 * @fileoverview Branded types for type-safe IDs and values.
 * 
 * Branded types prevent mixing up values that have the same underlying type
 * but represent different concepts (e.g., UserId vs PropertyId).
 * 
 * @example
 * ```typescript
 * const userId = 1 as UserId
 * const propertyId = 1 as PropertyId
 * 
 * // This would be a type error:
 * findUser(propertyId)  // Error: PropertyId is not assignable to UserId
 * ```
 */

// ============================================
// Brand Symbol (internal)
// ============================================

declare const __brand: unique symbol

type Brand<B> = { [__brand]: B }

/**
 * Create a branded type from a base type.
 * 
 * @typeParam T - Base type
 * @typeParam B - Brand identifier
 */
export type Branded<T, B> = T & Brand<B>

// ============================================
// Branded ID Types
// ============================================

/** User ID (positive integer) */
export type UserId = Branded<number, 'UserId'>

/** Property ID (positive integer) */
export type PropertyId = Branded<number, 'PropertyId'>

/** Client ID (positive integer) */
export type ClientId = Branded<number, 'ClientId'>

/** Document ID (positive integer) */
export type DocumentId = Branded<number, 'DocumentId'>

/** Generic entity ID (positive integer) */
export type EntityId = Branded<number, 'EntityId'>

// ============================================
// Branded Value Types
// ============================================

/** Email address (validated string) */
export type Email = Branded<string, 'Email'>

/** Phone number (validated string) */
export type Phone = Branded<string, 'Phone'>

/** Price (non-negative decimal as string) */
export type Price = Branded<string, 'Price'>

/** URL (validated string) */
export type Url = Branded<string, 'Url'>

/** JWT Token */
export type JWTToken = Branded<string, 'JWTToken'>

/** Refresh Token */
export type RefreshToken = Branded<string, 'RefreshToken'>

/** File Path (sanitized) */
export type FilePath = Branded<string, 'FilePath'>

/** Request Correlation ID */
export type CorrelationId = Branded<string, 'CorrelationId'>

// ============================================
// Type Guards & Constructors
// ============================================

/**
 * Check if a value is a positive integer suitable for an ID.
 */
export function isValidId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Create a UserId from a number.
 * @throws Error if value is not a positive integer
 */
export function createUserId(value: number): UserId {
  if (!isValidId(value)) {
    throw new Error(`Invalid UserId: ${String(value)}`)
  }
  return value as UserId
}

/**
 * Create a PropertyId from a number.
 * @throws Error if value is not a positive integer
 */
export function createPropertyId(value: number): PropertyId {
  if (!isValidId(value)) {
    throw new Error(`Invalid PropertyId: ${String(value)}`)
  }
  return value as PropertyId
}

/**
 * Create a ClientId from a number.
 * @throws Error if value is not a positive integer
 */
export function createClientId(value: number): ClientId {
  if (!isValidId(value)) {
    throw new Error(`Invalid ClientId: ${String(value)}`)
  }
  return value as ClientId
}

/**
 * Create a DocumentId from a number.
 * @throws Error if value is not a positive integer
 */
export function createDocumentId(value: number): DocumentId {
  if (!isValidId(value)) {
    throw new Error(`Invalid DocumentId: ${String(value)}`)
  }
  return value as DocumentId
}

// ============================================
// Email Validation
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Check if a string is a valid email.
 */
export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_REGEX.test(value)
}

/**
 * Create an Email from a string.
 * @throws Error if value is not a valid email
 */
export function createEmail(value: string): Email {
  if (!isValidEmail(value)) {
    throw new Error(`Invalid email: ${value}`)
  }
  return value.toLowerCase() as Email
}

// ============================================
// Price Validation
// ============================================

const PRICE_REGEX = /^\d+(\.\d{1,2})?$/

/**
 * Check if a string is a valid price.
 */
export function isValidPrice(value: unknown): value is string {
  if (typeof value === 'number') {
    return value >= 0
  }
  return typeof value === 'string' && PRICE_REGEX.test(value)
}

/**
 * Create a Price from a string or number.
 * @throws Error if value is not a valid price
 */
export function createPrice(value: string | number): Price {
  const stringValue = String(value)
  if (!isValidPrice(stringValue) && !isValidPrice(value)) {
    throw new Error(`Invalid price: ${stringValue}`)
  }
  return stringValue as Price
}

// ============================================
// Utility Type for extracting branded base type
// ============================================

/**
 * Extract the base type from a branded type.
 */
export type Unbrand<T> = T extends Branded<infer U, unknown> ? U : T
