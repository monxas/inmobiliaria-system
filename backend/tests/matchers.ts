/**
 * Custom Test Matchers for Domain Objects
 * 
 * Provides semantic assertions for inmobiliaria domain entities.
 */

import { expect } from 'bun:test'
import type { Property } from '../src/database/schema/properties'
import type { Client } from '../src/database/schema/clients'
import type { User } from '../src/database/schema/users'

// ── API Response Matchers ─────────────────────────────────────────

export function expectSuccessResponse(response: any) {
  expect(response).toHaveProperty('success', true)
  expect(response).toHaveProperty('data')
  expect(response).not.toHaveProperty('error')
  return response.data
}

export function expectErrorResponse(response: any, expectedCode?: number, expectedMessage?: string) {
  expect(response).toHaveProperty('success', false)
  expect(response).toHaveProperty('error')
  expect(response.error).toHaveProperty('code')
  expect(response.error).toHaveProperty('message')
  
  if (expectedCode !== undefined) {
    expect(response.error.code).toBe(expectedCode)
  }
  if (expectedMessage !== undefined) {
    expect(response.error.message).toContain(expectedMessage)
  }
  return response.error
}

export function expectPaginatedResponse(response: any, expectedMeta?: {
  page?: number
  limit?: number
  totalPages?: number
}) {
  expect(response).toHaveProperty('success', true)
  expect(response).toHaveProperty('data')
  expect(Array.isArray(response.data)).toBe(true)
  
  if (response.meta) {
    if (expectedMeta?.page) expect(response.meta.page).toBe(expectedMeta.page)
    if (expectedMeta?.limit) expect(response.meta.limit).toBe(expectedMeta.limit)
    if (expectedMeta?.totalPages) expect(response.meta.totalPages).toBe(expectedMeta.totalPages)
  }
  
  return response.data
}

// ── Property Matchers ─────────────────────────────────────────────

export function expectValidProperty(obj: unknown): asserts obj is Property {
  expect(obj).toHaveProperty('id')
  expect(obj).toHaveProperty('title')
  expect(obj).toHaveProperty('address')
  expect(obj).toHaveProperty('city')
  expect(obj).toHaveProperty('propertyType')
  expect(obj).toHaveProperty('price')
  
  const property = obj as Property
  expect(typeof property.id).toBe('number')
  expect(typeof property.title).toBe('string')
  expect(property.title.length).toBeGreaterThan(0)
  
  const validTypes = ['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']
  expect(validTypes).toContain(property.propertyType)
  
  if (property.bedrooms !== null && property.bedrooms !== undefined) {
    expect(property.bedrooms).toBeGreaterThanOrEqual(0)
  }
  if (property.bathrooms !== null && property.bathrooms !== undefined) {
    expect(property.bathrooms).toBeGreaterThanOrEqual(0)
  }
}

export function expectPropertyMatch(actual: unknown, expected: Partial<Property>) {
  expectValidProperty(actual)
  const property = actual as Property
  
  if (expected.title) expect(property.title).toBe(expected.title)
  if (expected.city) expect(property.city).toBe(expected.city)
  if (expected.propertyType) expect(property.propertyType).toBe(expected.propertyType)
  if (expected.price) expect(property.price).toBe(expected.price)
  if (expected.bedrooms !== undefined) expect(property.bedrooms).toBe(expected.bedrooms)
  if (expected.bathrooms !== undefined) expect(property.bathrooms).toBe(expected.bathrooms)
}

export function expectPropertyInList(list: unknown[], predicate: (p: Property) => boolean) {
  expect(Array.isArray(list)).toBe(true)
  const match = list.find(item => {
    try {
      expectValidProperty(item)
      return predicate(item as Property)
    } catch {
      return false
    }
  })
  expect(match).toBeDefined()
  return match as Property
}

// ── Client Matchers ───────────────────────────────────────────────

export function expectValidClient(obj: unknown): asserts obj is Client {
  expect(obj).toHaveProperty('id')
  expect(obj).toHaveProperty('fullName')
  
  const client = obj as Client
  expect(typeof client.id).toBe('number')
  expect(typeof client.fullName).toBe('string')
  expect(client.fullName.length).toBeGreaterThan(0)
  
  if (client.email) {
    expect(client.email).toMatch(/@/)
  }
  if (client.phone) {
    expect(typeof client.phone).toBe('string')
  }
}

export function expectClientMatch(actual: unknown, expected: Partial<Client>) {
  expectValidClient(actual)
  const client = actual as Client
  
  if (expected.fullName) expect(client.fullName).toBe(expected.fullName)
  if (expected.email) expect(client.email).toBe(expected.email)
  if (expected.phone) expect(client.phone).toBe(expected.phone)
}

// ── User Matchers ─────────────────────────────────────────────────

export function expectValidUser(obj: unknown): asserts obj is User {
  expect(obj).toHaveProperty('id')
  expect(obj).toHaveProperty('email')
  expect(obj).toHaveProperty('role')
  
  const user = obj as User
  expect(typeof user.id).toBe('number')
  expect(user.email).toMatch(/@/)
  
  const validRoles = ['admin', 'agent', 'client']
  expect(validRoles).toContain(user.role)
  
  // Password hash should NEVER be exposed
  if (typeof obj === 'object' && obj !== null && 'passwordHash' in obj) {
    expect((obj as Record<string, unknown>)['passwordHash']).not.toMatch(/^[$]2[aby]?[$]/)
  }
}

export function expectUserSafe(obj: unknown) {
  // Ensure sensitive fields are not exposed
  expect(obj).not.toHaveProperty('password')
  expect(obj).not.toHaveProperty('passwordHash')
}

// ── JWT Token Matchers ────────────────────────────────────────────

export function expectValidJWT(token: unknown): asserts token is string {
  expect(typeof token).toBe('string')
  const parts = (token as string).split('.')
  expect(parts.length).toBe(3) // header.payload.signature
  
  // Each part should be base64url encoded
  for (const part of parts) {
    expect(part.length).toBeGreaterThan(0)
    expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
  }
}

export function expectTokenPayload(token: string, expected: { userId?: number; role?: string; email?: string }) {
  expectValidJWT(token)
  
  const parts = token.split('.')
  const payloadPart = parts[1]
  if (!payloadPart) throw new Error('Invalid JWT: missing payload part')
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString())
  
  if (expected.userId !== undefined) expect(payload.userId).toBe(expected.userId)
  if (expected.role !== undefined) expect(payload.role).toBe(expected.role)
  if (expected.email !== undefined) expect(payload.email).toBe(expected.email)
  
  return payload
}

// ── Timing Matchers ───────────────────────────────────────────────

export async function expectFasterThan<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  expect(duration).toBeLessThan(ms)
  return result
}

export async function expectSlowerThan<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  expect(duration).toBeGreaterThan(ms)
  return result
}

// ── Collection Matchers ───────────────────────────────────────────

export function expectSortedBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc') {
  for (let i = 1; i < array.length; i++) {
    const current = array[i]
    const previous = array[i - 1]
    if (!current || !previous) continue
    if (order === 'asc') {
      expect(current[key] >= previous[key]).toBe(true)
    } else {
      expect(current[key] <= previous[key]).toBe(true)
    }
  }
}

export function expectUniqueBy<T>(array: T[], key: keyof T) {
  const values = array.map(item => item[key])
  const unique = new Set(values)
  expect(unique.size).toBe(values.length)
}

export function expectAllMatch<T>(array: T[], predicate: (item: T) => boolean) {
  expect(array.every(predicate)).toBe(true)
}

export function expectNoneMatch<T>(array: T[], predicate: (item: T) => boolean) {
  expect(array.some(predicate)).toBe(false)
}
