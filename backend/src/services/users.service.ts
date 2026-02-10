import { usersRepository, type UsersRepository } from '../repositories/users.repository'
import type { User } from '../database/schema'
import type { CreateUserInput, UpdateUserInput, UserFilters } from '../validation/schemas'
import { ValidationError, UnauthorizedError, NotFoundError } from '../types/errors'
import { hashPassword, comparePassword, signJWT } from '../utils/crypto'

// User without password hash for API responses
export type SafeUser = Omit<User, 'passwordHash'>

function omitPassword(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user
  return safeUser
}

interface PaginatedSafeUsers {
  data: SafeUser[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export class UsersService {
  repository: UsersRepository = usersRepository

  async findAll(
    filters: UserFilters,
    pagination: { page: number; limit: number }
  ): Promise<PaginatedSafeUsers> {
    const offset = (pagination.page - 1) * pagination.limit

    const [data, total] = await Promise.all([
      this.repository.findMany(filters, pagination.limit, offset),
      this.repository.count(filters),
    ])

    return {
      data: data.map(omitPassword),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    }
  }

  async findById(id: number): Promise<SafeUser | null> {
    const user = await this.repository.findById(id)
    return user ? omitPassword(user) : null
  }

  async create(input: CreateUserInput): Promise<SafeUser> {
    // Check for duplicate email
    const existing = await this.repository.findByEmail(input.email)
    if (existing) {
      throw new ValidationError('email', 'A user with this email already exists')
    }

    const passwordHash = await hashPassword(input.password)
    const { password, ...userData } = input

    const user = await this.repository.create({
      ...userData,
      passwordHash,
    })

    return omitPassword(user)
  }

  async update(id: number, input: UpdateUserInput): Promise<SafeUser> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new NotFoundError('User')
    }

    // Check for duplicate email if changing
    if (input.email && input.email !== existing.email) {
      const duplicate = await this.repository.findByEmail(input.email)
      if (duplicate) {
        throw new ValidationError('email', 'A user with this email already exists')
      }
    }

    const updateData: any = { ...input }
    
    // Hash new password if provided
    if (input.password) {
      updateData.passwordHash = await hashPassword(input.password)
      delete updateData.password
    }

    const user = await this.repository.update(id, updateData)
    return omitPassword(user)
  }

  async delete(id: number): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new NotFoundError('User')
    }
    await this.repository.delete(id)
  }

  async authenticate(email: string, password: string): Promise<{ user: SafeUser; token: string }> {
    const user = await this.repository.findByEmail(email)
    if (!user) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const token = signJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      full_name: user.fullName,
    })

    return {
      user: omitPassword(user),
      token,
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email)
  }
}

export const usersService = new UsersService()
