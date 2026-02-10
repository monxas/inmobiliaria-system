/**
 * @fileoverview Advanced utility types for DRY code.
 * 
 * These types reduce code duplication and improve type safety
 * throughout the application.
 */

// ============================================
// Object Manipulation Types
// ============================================

/**
 * Make specified keys required.
 * 
 * @example
 * type User = { name?: string; email?: string }
 * type UserWithEmail = RequiredKeys<User, 'email'>
 * // { name?: string; email: string }
 */
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Make specified keys optional.
 * 
 * @example
 * type User = { name: string; email: string }
 * type PartialUser = OptionalKeys<User, 'email'>
 * // { name: string; email?: string }
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Make all keys nullable.
 */
export type Nullable<T> = { [K in keyof T]: T[K] | null }

/**
 * Make specified keys nullable.
 */
export type NullableKeys<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null }

/**
 * Deep partial - makes all nested properties optional.
 */
export type DeepPartial<T> = T extends object 
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

/**
 * Deep readonly - makes all nested properties readonly.
 */
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T

/**
 * Deep required - makes all nested properties required.
 */
export type DeepRequired<T> = T extends object
  ? { [P in keyof T]-?: DeepRequired<T[P]> }
  : T

// ============================================
// Function Types
// ============================================

/**
 * Extract parameter types from a function.
 */
export type FunctionParams<T extends (...args: never[]) => unknown> = Parameters<T>

/**
 * Extract return type from a function.
 */
export type FunctionReturn<T extends (...args: never[]) => unknown> = ReturnType<T>

/**
 * Make a function async.
 */
export type AsyncFn<T extends (...args: never[]) => unknown> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>

/**
 * Promisify a return type.
 */
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>

// ============================================
// Entity Types
// ============================================

/**
 * Base entity with timestamps.
 */
export interface TimestampedEntity {
  readonly createdAt: Date
  readonly updatedAt: Date | null
}

/**
 * Soft-deletable entity.
 */
export interface SoftDeletableEntity extends TimestampedEntity {
  readonly deletedAt: Date | null
}

/**
 * Entity with ID.
 */
export interface IdentifiableEntity {
  readonly id: number
}

/**
 * Standard entity combining all base traits.
 */
export type StandardEntity = IdentifiableEntity & SoftDeletableEntity

/**
 * Create input type - omits auto-generated fields.
 */
export type CreateInput<T extends StandardEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>

/**
 * Update input type - partial without auto-generated fields.
 */
export type UpdateInput<T extends StandardEntity> = Partial<CreateInput<T>>

// ============================================
// API Types
// ============================================

/**
 * Paginated list response.
 */
export interface PaginatedResponse<T> {
  readonly data: readonly T[]
  readonly pagination: {
    readonly page: number
    readonly limit: number
    readonly total: number
    readonly pages: number
    readonly hasNext: boolean
    readonly hasPrev: boolean
  }
}

/**
 * Sorting options for queries.
 */
export interface SortOptions<T extends string = string> {
  readonly field: T
  readonly direction: 'asc' | 'desc'
}

/**
 * Filter base type for repositories.
 */
export type FilterBase = Record<string, string | number | boolean | null | undefined>

// ============================================
// Type Extraction
// ============================================

/**
 * Extract keys where value is of type V.
 * 
 * @example
 * type User = { name: string; age: number }
 * type StringKeys = KeysOfType<User, string>
 * // 'name'
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never
}[keyof T]

/**
 * Extract keys where value is not of type V.
 */
export type KeysNotOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? never : K
}[keyof T]

/**
 * Pick properties of a specific type.
 */
export type PickByType<T, V> = Pick<T, KeysOfType<T, V>>

/**
 * Omit properties of a specific type.
 */
export type OmitByType<T, V> = Pick<T, KeysNotOfType<T, V>>

// ============================================
// Union Types
// ============================================

/**
 * Exclude null and undefined from T.
 */
export type NonNullable<T> = T extends null | undefined ? never : T

/**
 * Get union of all values in an object type.
 */
export type ValueOf<T> = T[keyof T]

/**
 * Create a union type from array literal.
 */
export type ArrayToUnion<T extends readonly unknown[]> = T[number]

// ============================================
// String Types
// ============================================

/**
 * Non-empty string.
 */
export type NonEmptyString<T extends string = string> = T extends '' ? never : T

/**
 * Lowercase string literal.
 */
export type LowercaseString<T extends string> = Lowercase<T>

/**
 * Capitalize first letter.
 */
export type CapitalizedString<T extends string> = Capitalize<T>

// ============================================
// Tuple Types
// ============================================

/**
 * First element of a tuple.
 */
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never

/**
 * All elements except the first.
 */
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : never

/**
 * Last element of a tuple.
 */
export type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never

// ============================================
// Conditional Types
// ============================================

/**
 * If T extends U, return A, otherwise B.
 */
export type IfExtends<T, U, A, B> = T extends U ? A : B

/**
 * If T is never, return A, otherwise B.
 */
export type IfNever<T, A, B> = [T] extends [never] ? A : B

/**
 * If T is any, return A, otherwise B.
 */
export type IfAny<T, A, B> = 0 extends 1 & T ? A : B

// ============================================
// Assertion Types
// ============================================

/**
 * Ensure type is exactly T.
 */
export type Exact<T, U extends T> = T extends U ? U : never

/**
 * Ensure types are equal.
 */
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false

/**
 * Assert that a type is true.
 */
export type Assert<T extends true> = T
