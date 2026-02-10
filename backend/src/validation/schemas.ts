import { z } from 'zod'

// ============================================
// Property Schemas
// ============================================
export const PropertyTypeEnum = z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial'])
export const PropertyStatusEnum = z.enum(['available', 'reserved', 'sold', 'rented', 'off_market'])

export const CreatePropertySchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  address: z.string().min(5),
  city: z.string().min(2).max(100),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).default('España'),
  propertyType: PropertyTypeEnum,
  status: PropertyStatusEnum.default('available'),
  price: z.string().or(z.number()).transform(val => String(val)),
  surfaceArea: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  garage: z.boolean().default(false),
  garden: z.boolean().default(false),
  ownerId: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional(),
})

export const UpdatePropertySchema = CreatePropertySchema.partial()

export const PropertyFiltersSchema = z.object({
  city: z.string().optional(),
  propertyType: PropertyTypeEnum.optional(),
  status: PropertyStatusEnum.optional(),
  minPrice: z.string().or(z.number()).optional(),
  maxPrice: z.string().or(z.number()).optional(),
  minBedrooms: z.number().int().optional(),
  minSurface: z.number().int().optional(),
  ownerId: z.number().int().optional(),
  agentId: z.number().int().optional(),
})

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>
export type PropertyFilters = z.infer<typeof PropertyFiltersSchema>

// ============================================
// Client Schemas
// ============================================
export const CreateClientSchema = z.object({
  fullName: z.string().min(2).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  agentId: z.number().int().positive().optional().nullable(),
})

export const UpdateClientSchema = CreateClientSchema.partial()

export const ClientFiltersSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  agentId: z.number().int().optional(),
})

export type CreateClientInput = z.infer<typeof CreateClientSchema>
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>
export type ClientFilters = z.infer<typeof ClientFiltersSchema>

// ============================================
// User Schemas
// ============================================
export const UserRoleEnum = z.enum(['admin', 'agent', 'client'])

export const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  role: UserRoleEnum.default('client'),
  fullName: z.string().min(2).max(255),
  phone: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
})

export const UpdateUserSchema = z.object({
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(100).optional(),
  role: UserRoleEnum.optional(),
  fullName: z.string().min(2).max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
})

export const UserFiltersSchema = z.object({
  email: z.string().optional(),
  role: UserRoleEnum.optional(),
  fullName: z.string().optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UserFilters = z.infer<typeof UserFiltersSchema>

// ============================================
// Document Schemas
// ============================================
export const FileCategoryEnum = z.enum(['property_docs', 'property_images', 'client_docs', 'contracts', 'other'])

export const CreateDocumentSchema = z.object({
  filename: z.string().min(1).max(255),
  originalFilename: z.string().min(1).max(255),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive(),
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
  propertyId: z.number().int().optional(),
  clientId: z.number().int().optional(),
  uploadedBy: z.number().int().optional(),
  isPublic: z.boolean().optional(),
})

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>
export type DocumentFilters = z.infer<typeof DocumentFiltersSchema>

// ============================================
// Auth Schemas
// ============================================
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const RegisterSchema = CreateUserSchema

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
