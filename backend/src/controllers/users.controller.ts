import type { Context } from 'hono'
import { usersService, type UsersService, type SafeUser } from '../services/users.service'
import { 
  CreateUserSchema, 
  UpdateUserSchema,
  LoginSchema,
  type CreateUserInput, 
  type UpdateUserInput, 
  type UserFilters 
} from '../validation/schemas'
import { ValidationError, NotFoundError } from '../types/errors'
import { apiResponse, apiError } from '../utils/response'
import type { AppVariables } from '../types'

export class UsersController {
  service: UsersService = usersService

  private validateCreateInput(input: any): CreateUserInput {
    const result = CreateUserSchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  private validateUpdateInput(input: any): UpdateUserInput {
    const result = UpdateUserSchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  private parseFilters(query: Record<string, string>): UserFilters {
    return {
      email: query.email || undefined,
      role: query.role as any || undefined,
      fullName: query.fullName || undefined,
    }
  }

  private handleError(c: Context, error: unknown, defaultMessage: string) {
    if (error instanceof ValidationError) {
      return c.json(apiError(error.message, 400, error.details), 400)
    }
    if (error instanceof NotFoundError) {
      return c.json(apiError(error.message, 404), 404)
    }
    console.error(`UsersController:`, error)
    return c.json(apiError(defaultMessage, 500), 500)
  }

  // GET /users
  async findAll(c: Context) {
    const filters = this.parseFilters(c.req.query())
    const page = Number(c.req.query('page')) || 1
    const limit = Math.min(Number(c.req.query('limit')) || 10, 100)

    try {
      const result = await this.service.findAll(filters, { page, limit })
      return c.json(apiResponse(result.data, { pagination: result.pagination }))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch users')
    }
  }

  // GET /users/:id
  async findById(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)

    try {
      const user = await this.service.findById(id)
      if (!user) return c.json(apiError('User not found', 404), 404)
      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch user')
    }
  }

  // POST /users
  async create(c: Context) {
    try {
      const input = await c.req.json()
      const validatedInput = this.validateCreateInput(input)
      const user = await this.service.create(validatedInput)
      return c.json(apiResponse(user), 201)
    } catch (error) {
      return this.handleError(c, error, 'Failed to create user')
    }
  }

  // PUT /users/:id
  async update(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)

    try {
      const input = await c.req.json()
      const validatedInput = this.validateUpdateInput(input)
      const user = await this.service.update(id, validatedInput)
      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to update user')
    }
  }

  // DELETE /users/:id
  async delete(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)

    try {
      await this.service.delete(id)
      return c.json(apiResponse({ id, deleted: true }))
    } catch (error) {
      return this.handleError(c, error, 'Failed to delete user')
    }
  }

  // POST /auth/login
  async login(c: Context) {
    try {
      const input = await c.req.json()
      const result = LoginSchema.safeParse(input)
      if (!result.success) {
        const error = result.error.errors[0]
        return c.json(apiError(`Validation failed: ${error.message}`, 400), 400)
      }

      const { user, token } = await this.service.authenticate(result.data.email, result.data.password)
      return c.json(apiResponse({ user, token }))
    } catch (error) {
      return this.handleError(c, error, 'Authentication failed')
    }
  }

  // POST /auth/register
  async register(c: Context) {
    try {
      const input = await c.req.json()
      const validatedInput = this.validateCreateInput(input)
      // Force role to 'client' for self-registration
      validatedInput.role = 'client'
      const user = await this.service.create(validatedInput)
      return c.json(apiResponse(user), 201)
    } catch (error) {
      return this.handleError(c, error, 'Registration failed')
    }
  }

  // GET /auth/me
  async me(c: Context<{ Variables: AppVariables }>) {
    try {
      const authUser = c.get('user')
      if (!authUser) {
        return c.json(apiError('Not authenticated', 401), 401)
      }
      const user = await this.service.findById(authUser.id)
      if (!user) {
        return c.json(apiError('User not found', 404), 404)
      }
      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch user profile')
    }
  }

  // PUT /auth/me
  async updateMe(c: Context<{ Variables: AppVariables }>) {
    try {
      const authUser = c.get('user')
      if (!authUser) {
        return c.json(apiError('Not authenticated', 401), 401)
      }

      const input = await c.req.json()
      // Prevent role self-escalation
      delete input.role
      
      const validatedInput = this.validateUpdateInput(input)
      const user = await this.service.update(authUser.id, validatedInput)
      return c.json(apiResponse(user))
    } catch (error) {
      return this.handleError(c, error, 'Failed to update profile')
    }
  }
}

export const usersController = new UsersController()
