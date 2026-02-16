/**
 * @fileoverview Clients repository with CRM filtering and lead scoring.
 */

import { and, eq, ilike, or, isNull, gte, lte, sql, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db } from '../database/connection'
import { clients, clientInteractions, clientPropertyMatches, type Client, type ClientInteraction, type ClientPropertyMatch } from '../database/schema'
import type { ClientFilters, CreateInteractionInput } from '../validation/schemas'

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

    if (filters.search) {
      const searchPattern = `%${filters.search}%`
      conditions.push(
        or(
          ilike(clients.fullName, searchPattern),
          ilike(clients.email, searchPattern),
          ilike(clients.phone, searchPattern),
          ilike(clients.company, searchPattern),
          ilike(clients.tags, searchPattern)
        )!
      )
    }

    if (filters.fullName) {
      conditions.push(ilike(clients.fullName, `%${filters.fullName}%`))
    }

    if (filters.email) {
      conditions.push(ilike(clients.email, `%${filters.email}%`))
    }

    if (filters.agentId !== undefined) {
      conditions.push(eq(clients.agentId, filters.agentId))
    }

    if (filters.status) {
      conditions.push(eq(clients.status, filters.status))
    }

    if (filters.source) {
      conditions.push(eq(clients.source, filters.source))
    }

    if (filters.interestType) {
      conditions.push(eq(clients.interestType, filters.interestType))
    }

    if (filters.minLeadScore !== undefined) {
      conditions.push(gte(clients.leadScore, filters.minLeadScore))
    }

    if (filters.minBudget !== undefined) {
      conditions.push(gte(clients.budgetMin, String(filters.minBudget)))
    }

    if (filters.maxBudget !== undefined) {
      conditions.push(lte(clients.budgetMax, String(filters.maxBudget)))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

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

  async findByAgent(agentId: number): Promise<Client[]> {
    return this.findMany({ agentId } as ClientFilters, { limit: 100 })
  }

  /**
   * Update lead score for a client based on engagement data.
   */
  async updateLeadScore(clientId: number): Promise<number> {
    const client = await this.findById(clientId)
    if (!client) return 0

    let score = 0

    // Contact info completeness (max 25)
    if (client.email) score += 10
    if (client.phone) score += 10
    if (client.dni) score += 5

    // Profile completeness (max 15)
    if (client.address) score += 5
    if (client.occupation || client.company) score += 5
    if (client.budgetMin || client.budgetMax) score += 5

    // Engagement (max 35)
    const interactions = await this.db
      .select()
      .from(clientInteractions)
      .where(eq(clientInteractions.clientId, clientId))
    
    score += Math.min(interactions.length * 5, 20)
    
    // Recent contact bonus
    if (client.lastContactAt) {
      const daysSinceContact = (Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceContact < 7) score += 15
      else if (daysSinceContact < 30) score += 10
      else if (daysSinceContact < 90) score += 5
    }

    // Pipeline stage (max 15)
    const stageScores: Record<string, number> = {
      lead: 0, contacted: 5, qualified: 10, negotiating: 15, closed: 15, lost: 0
    }
    score += stageScores[client.status || 'lead'] || 0

    // Property interest (max 10)
    if (client.preferredZones) score += 3
    if (client.preferredPropertyTypes) score += 3
    if (client.totalViewings && client.totalViewings > 0) score += 4

    const finalScore = Math.min(score, 100)

    await this.db
      .update(clients)
      .set({ leadScore: finalScore, updatedAt: new Date() })
      .where(eq(clients.id, clientId))

    return finalScore
  }

  /**
   * Add an interaction and update engagement stats.
   */
  async addInteraction(input: CreateInteractionInput & { agentId?: number }): Promise<ClientInteraction> {
    const [interaction] = await this.db
      .insert(clientInteractions)
      .values({
        clientId: input.clientId,
        agentId: input.agentId,
        interactionType: input.interactionType,
        summary: input.summary,
        details: input.details,
        outcome: input.outcome,
        durationMinutes: input.durationMinutes,
      })
      .returning()

    // Update client engagement stats
    await this.db
      .update(clients)
      .set({
        lastContactAt: new Date(),
        totalContacts: sql`COALESCE(total_contacts, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, input.clientId))

    // Recalculate lead score
    await this.updateLeadScore(input.clientId)

    return interaction
  }

  /**
   * Get interactions for a client.
   */
  async getInteractions(clientId: number, limit = 50): Promise<ClientInteraction[]> {
    return this.db
      .select()
      .from(clientInteractions)
      .where(eq(clientInteractions.clientId, clientId))
      .orderBy(sql`${clientInteractions.createdAt} DESC`)
      .limit(limit)
  }

  /**
   * Match properties to a client based on preferences.
   */
  async matchProperties(clientId: number): Promise<ClientPropertyMatch[]> {
    const client = await this.findById(clientId)
    if (!client) return []

    // Build dynamic matching query
    const conditions: string[] = []
    const matchReasonCases: string[] = []

    if (client.budgetMin) {
      conditions.push(`p.price >= ${client.budgetMin}`)
    }
    if (client.budgetMax) {
      conditions.push(`p.price <= ${client.budgetMax}`)
    }

    // Build a scoring SQL query
    const query = sql`
      WITH scored AS (
        SELECT 
          p.id as property_id,
          (
            CASE WHEN ${client.budgetMin ? sql`p.price >= ${client.budgetMin}` : sql`TRUE`} 
              AND ${client.budgetMax ? sql`p.price <= ${client.budgetMax}` : sql`TRUE`} 
              THEN 30 ELSE 0 END
            + CASE WHEN ${client.minBedrooms ? sql`p.bedrooms >= ${client.minBedrooms}` : sql`TRUE`} THEN 15 ELSE 0 END
            + CASE WHEN ${client.minBathrooms ? sql`p.bathrooms >= ${client.minBathrooms}` : sql`TRUE`} THEN 10 ELSE 0 END
            + CASE WHEN ${client.minSurface ? sql`p.surface_area >= ${client.minSurface}` : sql`TRUE`} THEN 10 ELSE 0 END
            + CASE WHEN ${client.needsGarage ? sql`p.garage = true` : sql`TRUE`} THEN 10 ELSE 0 END
            + CASE WHEN ${client.needsGarden ? sql`p.garden = true` : sql`TRUE`} THEN 10 ELSE 0 END
            + CASE WHEN p.status = 'available' THEN 15 ELSE 0 END
          ) as match_score
        FROM properties p
        WHERE p.deleted_at IS NULL
          AND p.status IN ('available', 'reserved')
      )
      SELECT property_id, match_score 
      FROM scored 
      WHERE match_score >= 30
      ORDER BY match_score DESC
      LIMIT 20
    `

    const results = await this.db.execute(query)
    const matches: ClientPropertyMatch[] = []

    for (const row of results.rows as any[]) {
      const reasons: string[] = []
      if (row.match_score >= 70) reasons.push('Excelente coincidencia')
      else if (row.match_score >= 50) reasons.push('Buena coincidencia')
      else reasons.push('Coincidencia parcial')

      // Upsert match
      const [match] = await this.db
        .insert(clientPropertyMatches)
        .values({
          clientId,
          propertyId: row.property_id,
          matchScore: row.match_score,
          matchReasons: JSON.stringify(reasons),
          status: 'suggested',
        })
        .onConflictDoUpdate({
          target: [clientPropertyMatches.clientId, clientPropertyMatches.propertyId],
          set: {
            matchScore: row.match_score,
            matchReasons: JSON.stringify(reasons),
            updatedAt: new Date(),
          },
        })
        .returning()

      matches.push(match)
    }

    return matches
  }

  /**
   * Get property matches for a client.
   */
  async getPropertyMatches(clientId: number): Promise<ClientPropertyMatch[]> {
    return this.db
      .select()
      .from(clientPropertyMatches)
      .where(eq(clientPropertyMatches.clientId, clientId))
      .orderBy(sql`${clientPropertyMatches.matchScore} DESC`)
  }
}

/** Singleton repository instance */
export const clientsRepository = new ClientsRepository()
