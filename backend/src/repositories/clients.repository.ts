/**
 * @fileoverview Clients repository with type-safe filtering.
 */

import { and, eq, ilike, or, isNull, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db } from '../database/connection'
import { clients, type Client } from '../database/schema'
import type { ClientFilters } from '../validation/schemas'

/**
 * Repository for client CRUD operations.
 */
export class ClientsRepository extends CRUDRepository<Client, ClientFilters> {
  protected override readonly table = clients
  protected override readonly db = db
  protected override readonly hasSoftDelete = true

  /**
   * Build WHERE clause for client-specific filters.
   */
  protected override buildWhereClause(filters: ClientFilters): SQL | undefined {
    const conditions: SQL[] = []

    // Text search
    if (filters.search) {
      const searchPattern = `%${filters.search}%`
      conditions.push(
        or(
          ilike(clients.fullName, searchPattern),
          ilike(clients.email, searchPattern),
          ilike(clients.phone, searchPattern)
        )!
      )
    }

    // Name filter (partial match)
    if (filters.fullName) {
      conditions.push(ilike(clients.fullName, `%${filters.fullName}%`))
    }

    // Email filter (partial match)
    if (filters.email) {
      conditions.push(ilike(clients.email, `%${filters.email}%`))
    }

    // Agent filter (exact match)
    if (filters.agentId !== undefined) {
      conditions.push(eq(clients.agentId, filters.agentId))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * Find a client by exact email match.
   */
  async findByEmail(email: string): Promise<Client | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(clients.email, email),
        isNull(clients.deletedAt)
      ))
      .limit(1)
    
    return results[0] ?? null
  }

  /**
   * Find all clients assigned to an agent.
   */
  async findByAgent(agentId: number): Promise<Client[]> {
    return this.findMany({ agentId } as ClientFilters, { limit: 100 })
  }
}

/** Singleton repository instance */
export const clientsRepository = new ClientsRepository()
