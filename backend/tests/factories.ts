/**
 * Mock Data Factories — Generate test data for all entities
 */

import type { User, CreateUser } from '../src/database/schema/users'
import type { Property, CreateProperty } from '../src/database/schema/properties'
import type { Client } from '../src/database/schema/clients'
import type { UserRole } from '../src/types'

let counter = 0
const nextId = () => ++counter

export function resetFactoryCounter() {
  counter = 0
}

// ── Users ──────────────────────────────────────────
export function buildUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? nextId()
  return {
    id,
    email: `user${id}@test.com`,
    passwordHash: '$2a$12$fakehashfakehashfakehashfakehashfakehashfakehashfake',
    role: 'agent',
    fullName: `Test User ${id}`,
    phone: `+34600${String(id).padStart(6, '0')}`,
    avatarUrl: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  }
}

export function buildCreateUser(overrides: Partial<CreateUser> = {}): CreateUser {
  const id = nextId()
  return {
    email: `newuser${id}@test.com`,
    passwordHash: '$2a$12$fakehash',
    role: 'agent',
    fullName: `New User ${id}`,
    phone: `+34600${String(id).padStart(6, '0')}`,
    ...overrides,
  }
}

export function buildAdminUser(overrides: Partial<User> = {}): User {
  return buildUser({ role: 'admin', ...overrides })
}

export function buildClientUser(overrides: Partial<User> = {}): User {
  return buildUser({ role: 'client', ...overrides })
}

// ── Properties ─────────────────────────────────────
export function buildProperty(overrides: Partial<Property> = {}): Property {
  const id = overrides.id ?? nextId()
  return {
    id,
    title: `Property ${id}`,
    description: `A nice property #${id}`,
    address: `Calle Test ${id}`,
    city: 'Madrid',
    postalCode: '28001',
    country: 'España',
    propertyType: 'apartment',
    status: 'available',
    price: '250000.00',
    surfaceArea: 90,
    bedrooms: 3,
    bathrooms: 2,
    garage: false,
    garden: false,
    ownerId: null,
    agentId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  }
}

export function buildCreateProperty(overrides: Partial<CreateProperty> = {}): CreateProperty {
  const id = nextId()
  return {
    title: `New Property ${id}`,
    address: `Calle Nueva ${id}`,
    city: 'Barcelona',
    propertyType: 'house',
    price: '350000.00',
    ...overrides,
  }
}

// ── Clients ────────────────────────────────────────
export function buildClient(overrides: Partial<Client> = {}): Client {
  const id = overrides.id ?? nextId()
  return {
    id,
    fullName: `Client ${id}`,
    email: `client${id}@test.com`,
    phone: `+34611${String(id).padStart(6, '0')}`,
    address: `Avenida Cliente ${id}`,
    notes: null,
    agentId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  }
}

// ── JWT Payloads ───────────────────────────────────
export function buildJwtPayload(overrides: Partial<{
  userId: number
  email: string
  role: UserRole
  full_name: string
}> = {}) {
  return {
    userId: 1,
    email: 'test@test.com',
    role: 'agent' as UserRole,
    full_name: 'Test Agent',
    ...overrides,
  }
}
