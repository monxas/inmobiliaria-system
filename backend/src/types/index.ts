// ============================================
// Core Types — Inmobiliaria System
// ============================================

export type UserRole = 'admin' | 'agent' | 'client'

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface ApiResponseBody<T = unknown> {
  success: true
  data: T
  meta?: {
    pagination?: PaginationMeta
    [key: string]: unknown
  }
}

export interface ApiErrorBody {
  success: false
  error: {
    message: string
    code: number
    details?: unknown
  }
}

export interface FileRecord {
  id: number
  filename: string
  file_path: string
  mime_type: string
  file_size: number
  category: string
  created_at: Date
}

export interface FileManagerConfig {
  storagePath: string
  secretKey: string
  categories: Record<string, {
    maxSize: number
    allowedTypes: string[]
  }>
}

export type FileCategory = 'images' | 'documents'

// Hono context variables
export interface AppVariables {
  user?: {
    id: number
    email: string
    role: UserRole
    full_name: string
  }
}
