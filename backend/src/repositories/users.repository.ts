/**
 * @fileoverview Users repository with type-safe filtering.
 */

import { and, eq, ilike, or, isNull, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db } from '../database/connection'
import { users, type User, type CreateUser } from '../database/schema'
import type { UserFilters } from '../validation/schemas'

/**
 * Repository for user CRUD operations.
 */
export class UsersRepository extends CRUDRepository<User, UserFilters> {
  protected override readonly table = users
  protected override readonly db = db
  protected override readonly hasSoftDelete = true

  /**
   * Build WHERE clause for user-specific filters.
   */
  protected override buildWhereClause(filters: UserFilters): SQL | undefined {
    const conditions: SQL[] = []

    // Text search
    if (filters.search) {
      const searchPattern = `%${filters.search}%`
      conditions.push(
        or(
          ilike(users.fullName, searchPattern),
          ilike(users.email, searchPattern)
        )!
      )
    }

    // Email filter (partial match)
    if (filters.email) {
      conditions.push(ilike(users.email, `%${filters.email}%`))
    }

    // Role filter (exact match)
    if (filters.role) {
      conditions.push(eq(users.role, filters.role))
    }

    // Name filter (partial match)
    if (filters.fullName) {
      conditions.push(ilike(users.fullName, `%${filters.fullName}%`))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * Find a user by exact email match.
   */
  async findByEmail(email: string): Promise<User | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(users.email, email),
        isNull(users.deletedAt)
      ))
      .limit(1)
    
    return results[0] ?? null
  }

  /**
   * Check if an email is already registered.
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email)
    return user !== null
  }

  /**
   * Create a user with password hash.
   */
  async createWithPassword(data: CreateUser): Promise<User> {
    const results = await this.db
      .insert(this.table)
      .values(data)
      .returning()
    
    const user = results[0]
    if (!user) {
      throw new Error('Failed to create user')
    }
    return user
  }

  /**
   * Update user password.
   */
  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await this.db
      .update(this.table)
      .set({ 
        passwordHash,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
  }

  /**
   * Get user by ID without password hash.
   */
  async findByIdSafe(id: number): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.findById(id)
    if (!user) return null
    
    const { passwordHash: _, ...safeUser } = user
    return safeUser
  }
}

/** Singleton repository instance */
export const usersRepository = new UsersRepository()
