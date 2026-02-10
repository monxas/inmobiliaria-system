import type { ApiResponseBody, ApiErrorBody, PaginationMeta } from '../types'

export function apiResponse<T>(
  data: T,
  meta?: { pagination?: PaginationMeta; [key: string]: unknown }
): ApiResponseBody<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  }
}

export function apiError(
  message: string,
  code: number = 500,
  details?: unknown
): ApiErrorBody {
  return {
    success: false,
    error: {
      message,
      code,
      ...(details !== undefined ? { details } : {}),
    },
  }
}
