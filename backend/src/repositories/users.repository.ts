import { and, eq, ilike, isNull, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db, type Database } from '../database/connection'
import { users, type User } from '../database/schema'
import type { UserFilters } from '../validation/schemas'

export class UsersRepository extends CRUDRepository<User> {
  table = users
  db: Database = db

  protected buildWhereClause(filters: UserFilters): SQL | undefined {
    const conditions: SQL[] = []

    if (filters.email) {
      conditions.push(ilike(users.email, `%${filters.email}%`))
    }

    if (filters.role) {
      conditions.push(eq(users.role, filters.role))
    }

    if (filters.fullName) {
      conditions.push(ilike(users.fullName, `%${filters.fullName}%`))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  protected get hasSoftDelete(): boolean {
    return true
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(users.email, email),
        isNull(users.deletedAt)
      ))
      .limit(1)
    return result[0] || null
  }

  // Override create to omit password from default response
  async createWithPassword(data: any): Promise<User> {
    const result = await this.db
      .insert(this.table)
      .values(data)
      .returning()
    return result[0]
  }
}

export const usersRepository = new UsersRepository()
