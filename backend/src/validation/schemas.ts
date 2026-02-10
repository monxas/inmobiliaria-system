/**
 * @fileoverview Zod validation schemas for all API endpoints.
 * 
 * @module validation/schemas
 * 
 * @description
 * Centralized validation schemas using Zod. Each entity has:
 * - CreateSchema: For POST requests
 * - UpdateSchema: For PUT/PATCH requests (partial)
 * - FiltersSchema: For query params on list endpoints
 */

import { z } from 'zod'

// ============================================
// Security Utilities
// ============================================

/**
 * Pattern to detect common SQL injection attempts
 */
const SQL_INJECTION_PATTERN = /('|--|;|\/\*|\*\/|xp_|exec|execute|insert|select|delete|update|drop|create|alter|grant|union|script|javascript|vbscript)/i

/**
 * Sanitize string input by removing SQL injection patterns
 */
export function sanitizeString(value: string): string {
  return value.replace(SQL_INJECTION_PATTERN, '')
}

/**
 * Custom Zod transform to sanitize strings
 */
export const sanitizedString = (maxLength: number = 1000) =>
  z.string().max(maxLength).transform(sanitizeString)

// ============================================
// Common Field Schemas
// ============================================

const emailString = z.string().email().max(255).toLowerCase()
const phoneString = z.string().max(50).regex(/^[\d\s+\-().]+$/, 'Invalid phone format')
const urlString = z.string().url().max(500)

// ============================================
// Password Policy
// ============================================

/**
 * Strong password requirements:
 * - 8-100 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (optional for basic)
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be at most 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

/**
 * Even stronger password for admin accounts
 */
export const StrongPasswordSchema = PasswordSchema.regex(
  /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
  'Password must contain at least one special character'
)

// ============================================
// Pagination Schema
// ============================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export type PaginationInput = z.infer<typeof PaginationSchema>

// ============================================
// Property Schemas
// ============================================

export const PropertyTypeEnum = z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial'])
export type PropertyType = z.infer<typeof PropertyTypeEnum>

export const PropertyStatusEnum = z.enum(['available', 'reserved', 'sold', 'rented', 'off_market'])
export type PropertyStatus = z.infer<typeof PropertyStatusEnum>

export const CreatePropertySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().max(10000).optional(),
  address: z.string().min(5, 'Address must be at least 5 characters').max(500),
  city: z.string().min(2).max(100),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).default('España'),
  propertyType: PropertyTypeEnum,
  status: PropertyStatusEnum.default('available'),
  price: z.string().or(z.number()).transform(val => String(val)),
  surfaceArea: z.number().int().positive().max(1_000_000).optional(),
  bedrooms: z.number().int().min(0).max(100).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  garage: z.boolean().default(false),
  garden: z.boolean().default(false),
  ownerId: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional(),
})

export const UpdatePropertySchema = CreatePropertySchema.partial()

export const PropertyFiltersSchema = z.object({
  city: z.string().max(100).optional(),
  propertyType: PropertyTypeEnum.optional(),
  status: PropertyStatusEnum.optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minBedrooms: z.coerce.number().int().min(0).optional(),
  maxBedrooms: z.coerce.number().int().min(0).optional(),
  minSurface: z.coerce.number().int().positive().optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  agentId: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
})

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>
export type PropertyFilters = z.infer<typeof PropertyFiltersSchema>

// ============================================
// Client Schemas
// ============================================

export const CreateClientSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(255),
  email: emailString.optional().nullable(),
  phone: phoneString.optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  agentId: z.number().int().positive().optional().nullable(),
})

export const UpdateClientSchema = CreateClientSchema.partial()

export const ClientFiltersSchema = z.object({
  fullName: z.string().max(255).optional(),
  email: z.string().max(255).optional(),
  agentId: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
})

export type CreateClientInput = z.infer<typeof CreateClientSchema>
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>
export type ClientFilters = z.infer<typeof ClientFiltersSchema>

// ============================================
// User Schemas
// ============================================

export const UserRoleEnum = z.enum(['admin', 'agent', 'client'])
export type UserRole = z.infer<typeof UserRoleEnum>

export const CreateUserSchema = z.object({
  email: emailString,
  password: PasswordSchema,
  role: UserRoleEnum.default('client'),
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(255),
  phone: phoneString.optional().nullable(),
  avatarUrl: urlString.optional().nullable(),
})

export const UpdateUserSchema = z.object({
  email: emailString.optional(),
  password: PasswordSchema.optional(),
  role: UserRoleEnum.optional(),
  fullName: z.string().min(2).max(255).optional(),
  phone: phoneString.optional().nullable(),
  avatarUrl: urlString.optional().nullable(),
})

export const UserFiltersSchema = z.object({
  email: z.string().max(255).optional(),
  role: UserRoleEnum.optional(),
  fullName: z.string().max(255).optional(),
  search: z.string().max(200).optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UserFilters = z.infer<typeof UserFiltersSchema>

// ============================================
// Document Schemas
// ============================================

export const FileCategoryEnum = z.enum(['property_docs', 'property_images', 'client_docs', 'contracts', 'other'])
export type FileCategory = z.infer<typeof FileCategoryEnum>

/**
 * File size limits by category (in bytes)
 */
export const FileSizeLimits: Record<string, number> = {
  property_images: 10 * 1024 * 1024,  // 10MB
  property_docs: 25 * 1024 * 1024,    // 25MB
  client_docs: 25 * 1024 * 1024,      // 25MB
  contracts: 50 * 1024 * 1024,        // 50MB
  other: 10 * 1024 * 1024,            // 10MB
}

/**
 * Allowed MIME types by category
 */
export const AllowedMimeTypes: Record<string, string[]> = {
  property_images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  property_docs: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  client_docs: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  contracts: ['application/pdf'],
  other: ['application/pdf', 'image/jpeg', 'image/png'],
}

export const CreateDocumentSchema = z.object({
  filename: z.string().min(1).max(255),
  originalFilename: z.string().min(1).max(255),
  filePath: z.string().min(1).max(1000),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
  mimeType: z.string().min(1).max(100),
  category: FileCategoryEnum.default('other'),
  propertyId: z.number().int().positive().optional().nullable(),
  clientId: z.number().int().positive().optional().nullable(),
  accessToken: z.string().max(255).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isPublic: z.boolean().default(false),
  uploadedBy: z.number().int().positive(),
})

export const UpdateDocumentSchema = z.object({
  category: FileCategoryEnum.optional(),
  accessToken: z.string().max(255).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isPublic: z.boolean().optional(),
})

export const DocumentFiltersSchema = z.object({
  category: FileCategoryEnum.optional(),
  propertyId: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  uploadedBy: z.coerce.number().int().positive().optional(),
  isPublic: z.coerce.boolean().optional(),
})

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>
export type DocumentFilters = z.infer<typeof DocumentFiltersSchema>

// ============================================
// Auth Schemas
// ============================================

export const LoginSchema = z.object({
  email: emailString,
  password: z.string().min(1, 'Password is required'),
})

export const RegisterSchema = CreateUserSchema.omit({ role: true })

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
})

/**
 * Schema for updating own profile (restricted - no role/password).
 */
export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  phone: z.string().max(50).regex(/^[\d\s+\-().]*$/, 'Invalid phone format').optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
})

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>

// ============================================
// Shorthand Aliases for Testing
// ============================================

/** Alias for CreatePropertySchema - commonly used in tests */
export const propertySchema = CreatePropertySchema

/** Alias for CreateClientSchema - commonly used in tests */
export const clientSchema = CreateClientSchema

/** Alias for CreateUserSchema - commonly used in tests */
export const userSchema = CreateUserSchema

// ============================================
// Utility Functions
// ============================================

/**
 * Parse pagination from query params with defaults
 */
export function parsePagination(query: Record<string, string | undefined>): PaginationInput {
  return PaginationSchema.parse({ page: query.page, limit: query.limit })
}

/**
 * Parse filters leniently (ignore invalid fields)
 */
export function parseFilters<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  query: Record<string, string | undefined>
): Partial<z.infer<T>> {
  const result = schema.safeParse(query)
  if (result.success) {
    return Object.fromEntries(
      Object.entries(result.data).filter(([, v]) => v !== undefined)
    ) as Partial<z.infer<T>>
  }
  return {}
}
