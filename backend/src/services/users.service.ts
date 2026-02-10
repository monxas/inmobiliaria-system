/**
 * @fileoverview Users service with authentication logic.
 */

import { usersRepository } from '../repositories/users.repository'
import type { User, CreateUser } from '../database/schema'
import type { CreateUserInput, UpdateUserInput, UserFilters } from '../validation/schemas'
import { UnauthorizedError, NotFoundError, ConflictError, ErrorCodes } from '../types/errors'
import { hashPassword, comparePassword, signJWT } from '../utils/crypto'
import { logger } from '../lib/logger'
import type { PaginatedResult, PaginationParams } from '../types'

/** User without password hash - safe for API responses */
export type SafeUser = Omit<User, 'passwordHash'>

/**
 * Remove password hash from user object.
 */
function omitPassword(user: User): SafeUser {
  const { passwordHash: _, ...safeUser } = user
  return safeUser
}

/**
 * Service for user management and authentication.
 */
export class UsersService {
  private repository = usersRepository

  /**
   * Get all users with pagination.
   * Returns users without password hashes.
   */
  async findAll(
    filters: UserFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<SafeUser>> {
    const { page, limit } = pagination
    const offset = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.repository.findMany(filters, { limit, offset }),
      this.repository.count(filters),
    ])

    const pages = Math.ceil(total / limit)

    return {
      data: data.map(omitPassword),
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Get user by ID (without password).
   */
  async findById(id: number): Promise<SafeUser | null> {
    const user = await this.repository.findById(id)
    return user ? omitPassword(user) : null
  }

  /**
   * Create a new user.
   * 
   * @throws ConflictError if email already exists
   */
  async create(input: CreateUserInput): Promise<SafeUser> {
    // Check for duplicate email
    const existing = await this.repository.findByEmail(input.email)
    if (existing) {
      throw new ConflictError('User', 'email', input.email)
    }

    // Hash password
    const passwordHash = await hashPassword(input.password)
    const { password: _, ...userData } = input

    const createData: CreateUser = {
      ...userData,
      passwordHash,
    }

    const user = await this.repository.create(createData)

    logger.info('User created', { userId: user.id, email: user.email })

    return omitPassword(user)
  }

  /**
   * Update an existing user.
   * 
   * @throws NotFoundError if user doesn't exist
   * @throws ConflictError if email is taken by another user
   */
  async update(id: number, input: UpdateUserInput): Promise<SafeUser> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new NotFoundError('User', id)
    }

    // Check for duplicate email if changing
    if (input.email && input.email !== existing.email) {
      const duplicate = await this.repository.findByEmail(input.email)
      if (duplicate) {
        throw new ConflictError('User', 'email', input.email)
      }
    }

    // Build update data
    const updateData: Partial<CreateUser> = { ...input }
    
    // Hash new password if provided
    if (input.password) {
      updateData.passwordHash = await hashPassword(input.password)
      delete (updateData as UpdateUserInput).password
    }

    const user = await this.repository.update(id, updateData)

    logger.info('User updated', { userId: id })

    return omitPassword(user)
  }

  /**
   * Delete a user (soft delete).
   * 
   * @throws NotFoundError if user doesn't exist
   */
  async delete(id: number): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new NotFoundError('User', id)
    }

    await this.repository.delete(id)

    logger.info('User deleted', { userId: id })
  }

  /**
   * Authenticate user with email and password.
   * 
   * @returns User and JWT token
   * @throws UnauthorizedError if credentials are invalid
   */
  async authenticate(
    email: string, 
    password: string
  ): Promise<{ user: SafeUser; token: string }> {
    const user = await this.repository.findByEmail(email)
    
    if (!user) {
      // Use generic message to prevent user enumeration
      throw new UnauthorizedError('Invalid email or password', ErrorCodes.INVALID_CREDENTIALS)
    }

    const valid = await comparePassword(password, user.passwordHash)
    
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password', ErrorCodes.INVALID_CREDENTIALS)
    }

    const token = signJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      full_name: user.fullName,
    })

    logger.info('User authenticated', { userId: user.id })

    return {
      user: omitPassword(user),
      token,
    }
  }

  /**
   * Find user by email (internal use with password).
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email)
  }

  /**
   * Check if an email is already registered.
   */
  async emailExists(email: string): Promise<boolean> {
    return this.repository.emailExists(email)
  }

  /**
   * Change user password.
   * 
   * @throws UnauthorizedError if current password is wrong
   */
  async changePassword(
    userId: number, 
    currentPassword: string, 
    newPassword: string
  ): Promise<void> {
    const user = await this.repository.findById(userId)
    
    if (!user) {
      throw new NotFoundError('User', userId)
    }

    const valid = await comparePassword(currentPassword, user.passwordHash)
    
    if (!valid) {
      throw new UnauthorizedError('Current password is incorrect', ErrorCodes.INVALID_CREDENTIALS)
    }

    const passwordHash = await hashPassword(newPassword)
    await this.repository.updatePassword(userId, passwordHash)

    logger.info('Password changed', { userId })
  }
}

export const usersService = new UsersService()
