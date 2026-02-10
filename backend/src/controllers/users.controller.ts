/**
 * @fileoverview Users controller with authentication endpoints.
 * 
 * @description
 * Handles user CRUD operations plus authentication endpoints.
 */

import type { Context } from 'hono'
import { usersService, type UsersService } from '../services/users.service'
import { 
  CreateUserSchema, 
  UpdateUserSchema,
  UserFiltersSchema,
  LoginSchema,
  UpdateProfileSchema,
  PaginationSchema,
  type CreateUserInput, 
  type UpdateUserInput, 
  type UserFilters 
} from '../validation/schemas'
import { 
  ValidationError, 
  NotFoundError, 
  isAppError,
  ErrorCodes 
} from '../types/errors'
import { apiResponse, apiError } from '../utils/response'
import { logger } from '../lib/logger'
import type { AppVariables } from '../types'

/**
 * Controller for user management and authentication.
 */
export class UsersController {
  private readonly service: UsersService = usersService

  /**
   * GET /users - List users with pagination
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
      return this.handleError(c, error, 'Failed to fetch users')
    }
  }

  /**
   * GET /users/:id - Get user by ID
   */
  async findById(c: Context): Promise<Response> {
    const id = this.parseIdParam(c)
    if (id === null) {
      return c.json(apiError('Invalid ID', 400, ErrorCodes.INVALID_INPUT), 400)
    }

    try {
      const user = await this.service.findById(id)
      if (!user) {
        return c.json(apiError('User not found', 404, ErrorCodes.USER_NOT_FOUND), 404)
      }
      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch user')
    }
  }

  /**
   * POST /users - Create new user (admin only)
   */
  async create(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined

    try {
      const input = await c.req.json()
      const validatedInput = this.validateCreate(input)
      const user = await this.service.create(validatedInput)

      logger.info('User created', { userId: user.id, requestId })

      return c.json(apiResponse(user, { requestId }), 201)
    } catch (error) {
      return this.handleError(c, error, 'Failed to create user')
    }
  }

  /**
   * PUT /users/:id - Update user
   */
  async update(c: Context): Promise<Response> {
    const id = this.parseIdParam(c)
    if (id === null) {
      return c.json(apiError('Invalid ID', 400, ErrorCodes.INVALID_INPUT), 400)
    }

    try {
      const input = await c.req.json()
      const validatedInput = this.validateUpdate(input)
      const user = await this.service.update(id, validatedInput)

      logger.info('User updated', { userId: id })

      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to update user')
    }
  }

  /**
   * DELETE /users/:id - Delete user (soft delete)
   */
  async delete(c: Context): Promise<Response> {
    const id = this.parseIdParam(c)
    if (id === null) {
      return c.json(apiError('Invalid ID', 400, ErrorCodes.INVALID_INPUT), 400)
    }

    try {
      await this.service.delete(id)

      logger.info('User deleted', { userId: id })

      return c.json(apiResponse({ id, deleted: true }))
    } catch (error) {
      return this.handleError(c, error, 'Failed to delete user')
    }
  }

  // ============================================
  // Authentication Endpoints
  // ============================================

  /**
   * POST /auth/login - Authenticate user
   */
  async login(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined

    try {
      const input = await c.req.json()
      const result = LoginSchema.safeParse(input)

      if (!result.success) {
        const firstError = result.error.errors[0]
        return c.json(apiError(
          `Validation failed: ${firstError?.message ?? 'Invalid input'}`, 
          400, 
          ErrorCodes.VALIDATION_FAILED
        ), 400)
      }

      const { user, token } = await this.service.authenticate(
        result.data.email, 
        result.data.password
      )

      logger.info('User logged in', { userId: user.id, requestId })

      return c.json(apiResponse({ user, token }, { requestId }))
    } catch (error) {
      // Don't expose detailed auth errors
      if (isAppError(error) && error.statusCode === 401) {
        return c.json(apiError('Invalid email or password', 401, ErrorCodes.INVALID_CREDENTIALS), 401)
      }
      return this.handleError(c, error, 'Authentication failed')
    }
  }

  /**
   * POST /auth/register - Self-registration (role forced to 'client')
   */
  async register(c: Context): Promise<Response> {
    const requestId = c.get('requestId') as string | undefined

    try {
      const input = await c.req.json()
      const validatedInput = this.validateCreate(input)

      // Force role to 'client' for self-registration
      validatedInput.role = 'client'

      const user = await this.service.create(validatedInput)

      logger.info('User registered', { userId: user.id, requestId })

      return c.json(apiResponse(user, { requestId }), 201)
    } catch (error) {
      return this.handleError(c, error, 'Registration failed')
    }
  }

  /**
   * GET /auth/me - Get current user profile
   */
  async me(c: Context<{ Variables: AppVariables }>): Promise<Response> {
    const authUser = c.get('user')

    if (!authUser) {
      return c.json(apiError('Not authenticated', 401, ErrorCodes.AUTH_REQUIRED), 401)
    }

    try {
      const user = await this.service.findById(authUser.id)

      if (!user) {
        return c.json(apiError('User not found', 404, ErrorCodes.USER_NOT_FOUND), 404)
      }

      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch profile')
    }
  }

  /**
   * PUT /auth/me - Update current user profile
   */
  async updateMe(c: Context<{ Variables: AppVariables }>): Promise<Response> {
    const authUser = c.get('user')

    if (!authUser) {
      return c.json(apiError('Not authenticated', 401, ErrorCodes.AUTH_REQUIRED), 401)
    }

    try {
      const input = await c.req.json()

      // Validate with restricted schema (no role, no password)
      const result = UpdateProfileSchema.safeParse(input)
      if (!result.success) {
        const firstError = result.error.errors[0]
        return c.json(apiError(
          `Validation failed: ${firstError?.message ?? 'Invalid input'}`, 
          400, 
          ErrorCodes.VALIDATION_FAILED
        ), 400)
      }

      const user = await this.service.update(authUser.id, result.data)

      logger.info('Profile updated', { userId: authUser.id })

      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to update profile')
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private parseIdParam(c: Context): number | null {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id < 1) return null
    return id
  }

  private parsePagination(query: Record<string, string>) {
    const result = PaginationSchema.safeParse({
      page: query['page'],
      limit: query['limit'],
    })
    return result.success ? result.data : { page: 1, limit: 10 }
  }

  private parseFilters(query: Record<string, string>): UserFilters {
    const result = UserFiltersSchema.safeParse(query)
    if (result.success) {
      return Object.fromEntries(
        Object.entries(result.data).filter(([, v]) => v !== undefined)
      ) as UserFilters
    }
    return {}
  }

  private validateCreate(input: unknown): CreateUserInput {
    const result = CreateUserSchema.safeParse(input)
    if (!result.success) {
      const firstError = result.error.errors[0]
      throw new ValidationError(firstError?.path.join('.') || 'input', firstError?.message || 'Validation failed')
    }
    return result.data
  }

  private validateUpdate(input: unknown): UpdateUserInput {
    const result = UpdateUserSchema.safeParse(input)
    if (!result.success) {
      const firstError = result.error.errors[0]
      throw new ValidationError(firstError?.path.join('.') || 'input', firstError?.message || 'Validation failed')
    }
    return result.data
  }

  private handleError(c: Context, error: unknown, defaultMessage: string): Response {
    const requestId = c.get('requestId') as string | undefined

    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        logger.error('Server error', {
          controller: 'UsersController',
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
      ), error.statusCode as 400 | 401 | 403 | 404 | 500)
    }

    if (error instanceof ValidationError) {
      return c.json(apiError(error.message, 400, error.code, error.details), 400)
    }

    if (error instanceof NotFoundError) {
      return c.json(apiError(error.message, 404, error.code), 404)
    }

    logger.error('Unhandled error', {
      controller: 'UsersController',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
    })

    return c.json(apiError(defaultMessage, 500, ErrorCodes.INTERNAL_ERROR), 500)
  }
}

/** Singleton controller instance */
export const usersController = new UsersController()
