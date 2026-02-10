/**
 * OpenAPI Zod Schemas — Auto-generate OpenAPI 3.0 spec from these
 */
import { z } from '@hono/zod-openapi'

// ── Common ─────────────────────────────────────────
export const PaginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).default('1').openapi({ description: 'Page number', example: '1' }),
  limit: z.string().regex(/^\d+$/).default('10').openapi({ description: 'Items per page (max 100)', example: '10' }),
})

export const PaginationMetaSchema = z.object({
  page: z.number().openapi({ example: 1 }),
  limit: z.number().openapi({ example: 10 }),
  total: z.number().openapi({ example: 50 }),
  pages: z.number().openapi({ example: 5 }),
})

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string().openapi({ example: 'Validation failed' }),
    code: z.number().openapi({ example: 400 }),
    details: z.any().optional(),
  }),
}).openapi('ApiError')

export const HealthSchema = z.object({
  status: z.enum(['healthy', 'degraded']).openapi({ example: 'healthy' }),
  timestamp: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  version: z.string().openapi({ example: '0.1.0' }),
  checks: z.object({
    api: z.string().openapi({ example: 'ok' }),
    database: z.string().openapi({ example: 'ok' }),
  }),
}).openapi('HealthCheck')

// ── Auth ───────────────────────────────────────────
export const LoginInputSchema = z.object({
  email: z.string().email().openapi({ example: 'agent@inmobiliaria.es' }),
  password: z.string().min(6).openapi({ example: 'secret123' }),
}).openapi('LoginInput')

export const RegisterInputSchema = LoginInputSchema.extend({
  fullName: z.string().min(2).openapi({ example: 'Juan García' }),
  role: z.enum(['agent', 'client']).default('client').openapi({ example: 'agent' }),
}).openapi('RegisterInput')

export const AuthTokenSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().openapi({ example: 'eyJhbGci...' }),
    user: z.object({
      id: z.number(),
      email: z.string().email(),
      role: z.enum(['admin', 'agent', 'client']),
      fullName: z.string(),
    }).optional(),
  }),
}).openapi('AuthToken')

// ── Users ──────────────────────────────────────────
export const UserSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  email: z.string().email().openapi({ example: 'agent@inmobiliaria.es' }),
  role: z.enum(['admin', 'agent', 'client']).openapi({ example: 'agent' }),
  fullName: z.string().openapi({ example: 'Juan García' }),
  phone: z.string().nullable().openapi({ example: '+34600123456' }),
  avatarUrl: z.string().nullable().openapi({ example: null }),
  createdAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  updatedAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
}).openapi('User')

// ── Properties ─────────────────────────────────────
export const PropertySchema = z.object({
  id: z.number().openapi({ example: 1 }),
  title: z.string().openapi({ example: 'Piso en el centro de Madrid' }),
  description: z.string().nullable().openapi({ example: 'Amplio piso de 3 habitaciones' }),
  address: z.string().openapi({ example: 'Calle Gran Vía 42' }),
  city: z.string().openapi({ example: 'Madrid' }),
  postalCode: z.string().nullable().openapi({ example: '28013' }),
  country: z.string().openapi({ example: 'España' }),
  propertyType: z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']).openapi({ example: 'apartment' }),
  status: z.enum(['available', 'reserved', 'sold', 'rented', 'off_market']).openapi({ example: 'available' }),
  price: z.string().openapi({ example: '250000.00' }),
  surfaceArea: z.number().nullable().openapi({ example: 90 }),
  bedrooms: z.number().nullable().openapi({ example: 3 }),
  bathrooms: z.number().nullable().openapi({ example: 2 }),
  garage: z.boolean().openapi({ example: false }),
  garden: z.boolean().openapi({ example: false }),
  ownerId: z.number().nullable().openapi({ example: 1 }),
  agentId: z.number().nullable().openapi({ example: 2 }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('Property')

export const CreatePropertySchema = z.object({
  title: z.string().min(1).openapi({ example: 'Piso en Salamanca' }),
  description: z.string().optional(),
  address: z.string().min(1).openapi({ example: 'Calle Serrano 15' }),
  city: z.string().min(1).openapi({ example: 'Madrid' }),
  postalCode: z.string().optional(),
  country: z.string().default('España').optional(),
  propertyType: z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']),
  status: z.enum(['available', 'reserved', 'sold', 'rented', 'off_market']).default('available').optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  surfaceArea: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  garage: z.boolean().default(false).optional(),
  garden: z.boolean().default(false).optional(),
  ownerId: z.number().int().optional(),
  agentId: z.number().int().optional(),
}).openapi('CreateProperty')

export const UpdatePropertySchema = CreatePropertySchema.partial().openapi('UpdateProperty')

// ── Clients ────────────────────────────────────────
export const ClientSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  fullName: z.string().openapi({ example: 'María López' }),
  email: z.string().email().nullable().openapi({ example: 'maria@example.com' }),
  phone: z.string().nullable().openapi({ example: '+34611222333' }),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  agentId: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('Client')

export const CreateClientSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  agentId: z.number().int().optional(),
}).openapi('CreateClient')

export const UpdateClientSchema = CreateClientSchema.partial().openapi('UpdateClient')

// ── Documents ──────────────────────────────────────
export const DocumentSchema = z.object({
  id: z.number(),
  filename: z.string(),
  originalFilename: z.string(),
  filePath: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  category: z.enum(['property_docs', 'property_images', 'client_docs', 'contracts', 'other']),
  propertyId: z.number().nullable(),
  clientId: z.number().nullable(),
  isPublic: z.boolean(),
  uploadedBy: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('Document')
