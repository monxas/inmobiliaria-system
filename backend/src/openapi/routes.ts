/**
 * OpenAPI Route Definitions — Defines all API routes with full documentation
 */
import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import {
  HealthSchema,
  ApiErrorSchema,
  LoginInputSchema,
  RegisterInputSchema,
  AuthTokenSchema,
  PropertySchema,
  CreatePropertySchema,
  UpdatePropertySchema,
  ClientSchema,
  CreateClientSchema,
  UserSchema,
  PaginationQuerySchema,
} from './schemas'

// Helper to wrap data in API response
const successWrapper = (schema: z.ZodType) =>
  z.object({
    success: z.literal(true),
    data: schema,
    meta: z.object({ pagination: z.any() }).optional(),
  })

// ── Health ─────────────────────────────────────────
export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  description: 'Returns API and database health status',
  responses: {
    200: { content: { 'application/json': { schema: HealthSchema } }, description: 'Healthy' },
    503: { content: { 'application/json': { schema: HealthSchema } }, description: 'Degraded' },
  },
})

// ── Auth ───────────────────────────────────────────
export const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Login',
  description: 'Authenticate with email and password. Returns JWT token.',
  request: { body: { content: { 'application/json': { schema: LoginInputSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: AuthTokenSchema } }, description: 'Login successful' },
    401: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Invalid credentials' },
  },
})

export const registerRoute = createRoute({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Register',
  description: 'Create a new user account. Returns JWT token.',
  request: { body: { content: { 'application/json': { schema: RegisterInputSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: AuthTokenSchema } }, description: 'Registration successful' },
    400: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Validation error' },
    409: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Email already registered' },
  },
})

export const meRoute = createRoute({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Current user profile',
  description: 'Get the authenticated user profile. Requires Bearer token.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: successWrapper(UserSchema) } }, description: 'User profile' },
    401: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Not authenticated' },
  },
})

// ── Properties ─────────────────────────────────────
export const listPropertiesRoute = createRoute({
  method: 'get',
  path: '/properties',
  tags: ['Properties'],
  summary: 'List properties',
  description: 'Get paginated list of properties with optional filters.',
  request: { query: PaginationQuerySchema.extend({
    city: z.string().optional().openapi({ description: 'Filter by city' }),
    status: z.enum(['available', 'reserved', 'sold', 'rented', 'off_market']).optional(),
    propertyType: z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']).optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
  }) },
  responses: {
    200: { content: { 'application/json': { schema: successWrapper(z.array(PropertySchema)) } }, description: 'Property list' },
  },
})

export const getPropertyRoute = createRoute({
  method: 'get',
  path: '/properties/{id}',
  tags: ['Properties'],
  summary: 'Get property by ID',
  request: { params: z.object({ id: z.string().regex(/^\d+$/) }) },
  responses: {
    200: { content: { 'application/json': { schema: successWrapper(PropertySchema) } }, description: 'Property details' },
    404: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Not found' },
  },
})

export const createPropertyRoute = createRoute({
  method: 'post',
  path: '/properties',
  tags: ['Properties'],
  summary: 'Create property',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreatePropertySchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: successWrapper(PropertySchema) } }, description: 'Created' },
    400: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Validation error' },
    401: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Not authenticated' },
  },
})

export const updatePropertyRoute = createRoute({
  method: 'put',
  path: '/properties/{id}',
  tags: ['Properties'],
  summary: 'Update property',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().regex(/^\d+$/) }),
    body: { content: { 'application/json': { schema: UpdatePropertySchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: successWrapper(PropertySchema) } }, description: 'Updated' },
    404: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Not found' },
  },
})

export const deletePropertyRoute = createRoute({
  method: 'delete',
  path: '/properties/{id}',
  tags: ['Properties'],
  summary: 'Delete property',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().regex(/^\d+$/) }) },
  responses: {
    200: { content: { 'application/json': { schema: successWrapper(z.object({ id: z.number(), deleted: z.literal(true) })) } }, description: 'Deleted' },
    404: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Not found' },
  },
})

// ── Clients ────────────────────────────────────────
export const listClientsRoute = createRoute({
  method: 'get',
  path: '/clients',
  tags: ['Clients'],
  summary: 'List clients',
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuerySchema.extend({
    search: z.string().optional().openapi({ description: 'Search by name or email' }),
  }) },
  responses: {
    200: { content: { 'application/json': { schema: successWrapper(z.array(ClientSchema)) } }, description: 'Client list' },
  },
})

export const getClientRoute = createRoute({
  method: 'get',
  path: '/clients/{id}',
  tags: ['Clients'],
  summary: 'Get client by ID',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().regex(/^\d+$/) }) },
  responses: {
    200: { content: { 'application/json': { schema: successWrapper(ClientSchema) } }, description: 'Client details' },
    404: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Not found' },
  },
})

export const createClientRoute = createRoute({
  method: 'post',
  path: '/clients',
  tags: ['Clients'],
  summary: 'Create client',
  security: [{ bearerAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateClientSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: successWrapper(ClientSchema) } }, description: 'Created' },
    400: { content: { 'application/json': { schema: ApiErrorSchema } }, description: 'Validation error' },
  },
})
