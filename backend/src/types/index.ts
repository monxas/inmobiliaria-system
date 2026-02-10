/**
 * @fileoverview Central type exports for the Inmobiliaria System API.
 * 
 * @module types
 */

// ============================================
// Re-exports
// ============================================
export * from './errors'

// ============================================
// Core Types
// ============================================

/** User role enum type */
export type UserRole = 'admin' | 'agent' | 'client'

/** Property type enum */
export type PropertyType = 'house' | 'apartment' | 'office' | 'warehouse' | 'land' | 'commercial'

/** Property status enum */
export type PropertyStatus = 'available' | 'reserved' | 'sold' | 'rented' | 'off_market'

/** Document category enum */
export type FileCategory = 'property_docs' | 'property_images' | 'client_docs' | 'contracts' | 'other'

// ============================================
// Pagination Types
// ============================================

/**
 * Standard pagination parameters for list endpoints.
 */
export interface PaginationParams {
  /** Current page (1-indexed) */
  page: number
  /** Items per page */
  limit: number
}

/**
 * Pagination metadata returned in list responses.
 */
export interface PaginationMeta {
  /** Current page number */
  page: number
  /** Items per page */
  limit: number
  /** Total number of items */
  total: number
  /** Total number of pages */
  pages: number
  /** Whether there's a next page */
  hasNext: boolean
  /** Whether there's a previous page */
  hasPrev: boolean
}

/**
 * Paginated result wrapper.
 */
export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMeta
}

// ============================================
// API Response Types
// ============================================

/**
 * Successful API response body.
 */
export interface ApiResponseBody<T = unknown> {
  success: true
  data: T
  meta?: {
    pagination?: PaginationMeta
    requestId?: string
    timestamp?: string
    [key: string]: unknown
  }
}

/**
 * Error API response body.
 */
export interface ApiErrorBody {
  success: false
  error: {
    /** Human-readable error message */
    message: string
    /** Machine-readable error code (e.g., 'VALIDATION_FAILED') */
    code: string
    /** HTTP status code */
    statusCode: number
    /** Additional error details */
    details?: Record<string, unknown>
    /** Request correlation ID */
    requestId?: string
    /** ISO timestamp */
    timestamp?: string
  }
}

/**
 * Union type for all API responses.
 */
export type ApiResponse<T = unknown> = ApiResponseBody<T> | ApiErrorBody

// ============================================
// File & Document Types
// ============================================

/**
 * File record as stored in database.
 */
export interface FileRecord {
  id: number
  filename: string
  originalFilename: string
  filePath: string
  mimeType: string
  fileSize: number
  category: FileCategory
  propertyId?: number | null
  clientId?: number | null
  uploadedBy: number
  isPublic: boolean
  accessToken?: string | null
  expiresAt?: Date | null
  createdAt: Date
}

/**
 * File upload configuration per category.
 */
export interface FileCategoryConfig {
  maxSize: number
  allowedTypes: readonly string[]
  maxFiles?: number
}

/**
 * File manager configuration.
 */
export interface FileManagerConfig {
  storagePath: string
  secretKey: string
  categories: Record<FileCategory, FileCategoryConfig>
}

// ============================================
// Authentication Types
// ============================================

/**
 * JWT payload structure.
 */
export interface JWTPayload {
  id: number
  email: string
  role: UserRole
  fullName: string
  iat: number
  exp: number
}

/**
 * User context set by auth middleware.
 */
export interface AuthUser {
  id: number
  email: string
  role: UserRole
  fullName: string
}

// ============================================
// Hono Context Variables
// ============================================

/**
 * Custom Hono context variables.
 */
export interface AppVariables {
  /** Authenticated user (set by requireAuth middleware) */
  user?: AuthUser
  /** Request correlation ID (set by correlationId middleware) */
  requestId?: string
  /** Request start timestamp for duration tracking */
  requestStart?: number
}

// ============================================
// Query Types
// ============================================

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Generic sort options.
 */
export interface SortOptions<T extends string = string> {
  field: T
  direction: SortDirection
}

/**
 * Date range filter.
 */
export interface DateRange {
  from?: Date | string
  to?: Date | string
}

/**
 * Generic search query params.
 */
export interface SearchParams {
  query?: string
  page?: number
  limit?: number
  sortBy?: string
  sortDir?: SortDirection
}

// ============================================
// Health Check Types
// ============================================

/**
 * Health check status.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Service health details.
 */
export interface ServiceHealth {
  status: HealthStatus
  latencyMs?: number
  message?: string
  lastCheck?: string
}

/**
 * Detailed health check response.
 */
export interface HealthCheckResponse {
  status: HealthStatus
  version: string
  uptime: number
  timestamp: string
  services: {
    database: ServiceHealth
    storage?: ServiceHealth
    cache?: ServiceHealth
  }
}
