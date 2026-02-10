import { and, eq, ilike, isNull, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db, type Database } from '../database/connection'
import { clients, type Client } from '../database/schema'
import type { ClientFilters } from '../validation/schemas'

export class ClientsRepository extends CRUDRepository<Client> {
  table = clients
  db: Database = db

  protected buildWhereClause(filters: ClientFilters): SQL | undefined {
    const conditions: SQL[] = []

    if (filters.fullName) {
      conditions.push(ilike(clients.fullName, `%${filters.fullName}%`))
    }

    if (filters.email) {
      conditions.push(ilike(clients.email, `%${filters.email}%`))
    }

    if (filters.agentId) {
      conditions.push(eq(clients.agentId, filters.agentId))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  protected get hasSoftDelete(): boolean {
    return true
  }

  async findByEmail(email: string): Promise<Client | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(clients.email, email),
        isNull(clients.deletedAt)
      ))
      .limit(1)
    return result[0] || null
  }
}

export const clientsRepository = new ClientsRepository()
