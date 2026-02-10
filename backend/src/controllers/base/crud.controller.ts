/**
 * @fileoverview Type-safe base CRUD controller for Hono.
 * 
 * @description
 * Provides standard REST endpoints with:
 * - Proper validation using Zod schemas
 * - Structured error handling
 * - Request logging
 * - Pagination support
 */

import type { Context } from 'hono'
import type { z } from 'zod'
import { apiResponse, apiError } from '../../utils/response'
import { 
  ValidationError, 
  NotFoundError, 
  isAppError,
  ErrorCodes 
} from '../../types/errors'
import type { CRUDService } from '../../services/base/crud.service'
import { logger } from '../../lib/logger'
import { PaginationSchema, type PaginationInput } from '../../validation/schemas'

/**
 * Abstract base controller providing type-safe CRUD endpoints.
 * 
 * @typeParam TEntity - The entity type returned by the service
 * @typeParam TCreateInput - The validated create input type
 * @typeParam TUpdateInput - The validated update input type
 * @typeParam TFilters - The filter type for list queries
 */
export abstract class CRUDController<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TFilters = Record<string, unknown>
> {
  /** The service layer for this resource */
  protected abstract readonly service: CRUDService<TEntity, TCreateInput, TUpdateInput, TFilters>
  
  /** Zod schema for create validation */
  protected abstract readonly createSchema: z.ZodSchema
  
  /** Zod schema for update validation */
  protected abstract readonly updateSchema: z.ZodSchema
  
  /** Zod schema for filter validation */
  protected abstract readonly filtersSchema: z.ZodSchema

  /** Resource name for error messages */
  protected get resourceName(): string {
    return 'Resource'
  }

  /**
   * GET /resources - List with pagination and filtering
   */
  async findAll(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined

    try {
      const pagination = this.parsePagination(c.req.query())
      const filters = this.parseFilters(c.req.query())

      const result = await this.service.findAll(filters, pagination)

      return c.json(apiResponse(result.data, { 
        pagination: result.pagination,
        requestId 
      }))
    } catch (error) {
      return this.handleError(c, error, `Failed to fetch ${this.resourceName.toLowerCase()}s`)
    }
  }

  /**
   * GET /resources/:id - Get single resource
   */
  async findById(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined
    const id = this.parseIdParam(c)
    
    if (id === null) {
      return c.json(apiError('Invalid ID parameter', 400, ErrorCodes.INVALID_INPUT), 400)
    }

    try {
      const data = await this.service.findById(id)
      
      if (!data) {
        return c.json(apiError(`${this.resourceName} not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND), 404)
      }

      return c.json(apiResponse(data, { requestId }))
    } catch (error) {
      return this.handleError(c, error, `Failed to fetch ${this.resourceName.toLowerCase()}`)
    }
  }

  /**
   * POST /resources - Create new resource
   */
  async create(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined

    try {
      const body = await c.req.json()
      const validatedInput = this.validateCreateInput(body)
      const data = await this.service.create(validatedInput)

      logger.info(`${this.resourceName} created`, { 
        resourceId: (data as { id?: number }).id,
        requestId 
      })

      return c.json(apiResponse(data, { requestId }), 201)
    } catch (error) {
      return this.handleError(c, error, `Failed to create ${this.resourceName.toLowerCase()}`)
    }
  }

  /**
   * PUT /resources/:id - Update existing resource
   */
  async update(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined
    const id = this.parseIdParam(c)
    
    if (id === null) {
      return c.json(apiError('Invalid ID parameter', 400, ErrorCodes.INVALID_INPUT), 400)
    }

    try {
      const body = await c.req.json()
      const validatedInput = this.validateUpdateInput(body)
      const data = await this.service.update(id, validatedInput)

      logger.info(`${this.resourceName} updated`, { resourceId: id, requestId })

      return c.json(apiResponse(data, { requestId }))
    } catch (error) {
      return this.handleError(c, error, `Failed to update ${this.resourceName.toLowerCase()}`)
    }
  }

  /**
   * DELETE /resources/:id - Delete resource
   */
  async delete(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined
    const id = this.parseIdParam(c)
    
    if (id === null) {
      return c.json(apiError('Invalid ID parameter', 400, ErrorCodes.INVALID_INPUT), 400)
    }

    try {
      await this.service.delete(id)

      logger.info(`${this.resourceName} deleted`, { resourceId: id, requestId })

      return c.json(apiResponse({ id, deleted: true }, { requestId }))
    } catch (error) {
      return this.handleError(c, error, `Failed to delete ${this.resourceName.toLowerCase()}`)
    }
  }

  // ============================================
  // Validation Methods
  // ============================================

  /**
   * Parse and validate ID path parameter.
   */
  protected parseIdParam(c: Context): number | null {
    const idStr = c.req.param('id')
    const id = Number(idStr)
    
    if (!idStr || !Number.isInteger(id) || id < 1) {
      return null
    }
    
    return id
  }

  /**
   * Parse and validate pagination parameters.
   */
  protected parsePagination(query: Record<string, string>): PaginationInput {
    const result = PaginationSchema.safeParse({
      page: query['page'],
      limit: query['limit'],
    })

    if (result.success) {
      return result.data
    }

    // Return defaults on validation failure
    return { page: 1, limit: 10 }
  }

  /**
   * Validate and parse create input using the schema.
   */
  protected validateCreateInput(input: unknown): TCreateInput {
    const result = this.createSchema.safeParse(input)
    
    if (!result.success) {
      const firstError = result.error.errors[0]
      const path = firstError?.path.join('.') || 'input'
      const message = firstError?.message || 'Validation failed'
      throw new ValidationError(path, message, { zodErrors: result.error.errors })
    }
    
    return result.data
  }

  /**
   * Validate and parse update input using the schema.
   */
  protected validateUpdateInput(input: unknown): TUpdateInput {
    const result = this.updateSchema.safeParse(input)
    
    if (!result.success) {
      const firstError = result.error.errors[0]
      const path = firstError?.path.join('.') || 'input'
      const message = firstError?.message || 'Validation failed'
      throw new ValidationError(path, message, { zodErrors: result.error.errors })
    }
    
    return result.data
  }

  /**
   * Parse and validate filter parameters.
   */
  protected parseFilters(query: Record<string, string>): TFilters {
    const result = this.filtersSchema.safeParse(query)
    
    if (result.success) {
      // Remove undefined values
      return Object.fromEntries(
        Object.entries(result.data as Record<string, unknown>).filter(([, v]) => v !== undefined)
      ) as TFilters
    }

    // Return empty filters on parse failure
    return {} as TFilters
  }

  // ============================================
  // Error Handling
  // ============================================

  /**
   * Handle errors with structured logging and consistent responses.
   */
  protected handleError(c: Context, error: unknown, defaultMessage: string): Response {
    const requestId = c.get('requestId') as string | undefined

    // Handle known application errors
    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        logger.error('Server error in controller', {
          controller: this.constructor.name,
          error: error.message,
          code: error.code,
          requestId,
        })
      }

      return c.json(apiError(
        error.message,
        error.statusCode,
        error.code,
        error.details
      ), error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500)
    }

    // Handle validation errors specially
    if (error instanceof ValidationError) {
      return c.json(apiError(error.message, 400, error.code, error.details), 400)
    }

    // Handle not found errors
    if (error instanceof NotFoundError) {
      return c.json(apiError(error.message, 404, error.code), 404)
    }

    // Log unknown errors
    logger.error('Unhandled error in controller', {
      controller: this.constructor.name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
    })

    return c.json(apiError(defaultMessage, 500, ErrorCodes.INTERNAL_ERROR), 500)
  }
}
