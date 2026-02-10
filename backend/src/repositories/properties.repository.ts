/**
 * @fileoverview Properties repository with type-safe filtering.
 */

import { and, eq, gte, lte, ilike, or, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db } from '../database/connection'
import { properties, type Property } from '../database/schema'
import type { PropertyFilters } from '../validation/schemas'

/**
 * Repository for property CRUD operations.
 */
export class PropertiesRepository extends CRUDRepository<Property, PropertyFilters> {
  protected override readonly table = properties
  protected override readonly db = db
  protected override readonly hasSoftDelete = true

  /**
   * Build WHERE clause for property-specific filters.
   */
  protected override buildWhereClause(filters: PropertyFilters): SQL | undefined {
    const conditions: SQL[] = []

    // Text search (title, address, city)
    if (filters.search) {
      const searchPattern = `%${filters.search}%`
      conditions.push(
        or(
          ilike(properties.title, searchPattern),
          ilike(properties.address, searchPattern),
          ilike(properties.city, searchPattern)
        )!
      )
    }

    // City filter (partial match)
    if (filters.city) {
      conditions.push(ilike(properties.city, `%${filters.city}%`))
    }

    // Property type (exact match)
    if (filters.propertyType) {
      conditions.push(eq(properties.propertyType, filters.propertyType))
    }

    // Status (exact match)
    if (filters.status) {
      conditions.push(eq(properties.status, filters.status))
    }

    // Price range
    if (filters.minPrice !== undefined) {
      conditions.push(gte(properties.price, String(filters.minPrice)))
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(lte(properties.price, String(filters.maxPrice)))
    }

    // Bedrooms range
    if (filters.minBedrooms !== undefined) {
      conditions.push(gte(properties.bedrooms, filters.minBedrooms))
    }
    if (filters.maxBedrooms !== undefined) {
      conditions.push(lte(properties.bedrooms, filters.maxBedrooms))
    }

    // Surface area range
    if (filters.minSurface !== undefined) {
      conditions.push(gte(properties.surfaceArea, filters.minSurface))
    }

    // Owner and agent filters
    if (filters.ownerId !== undefined) {
      conditions.push(eq(properties.ownerId, filters.ownerId))
    }
    if (filters.agentId !== undefined) {
      conditions.push(eq(properties.agentId, filters.agentId))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * Find properties by owner.
   */
  async findByOwner(ownerId: number): Promise<Property[]> {
    return this.findMany({ ownerId } as PropertyFilters, { limit: 100 })
  }

  /**
   * Find properties by agent.
   */
  async findByAgent(agentId: number): Promise<Property[]> {
    return this.findMany({ agentId } as PropertyFilters, { limit: 100 })
  }

  /**
   * Find available properties in a city.
   */
  async findAvailableInCity(city: string): Promise<Property[]> {
    return this.findMany(
      { city, status: 'available' } as PropertyFilters, 
      { limit: 50 }
    )
  }
}

/** Singleton repository instance */
export const propertiesRepository = new PropertiesRepository()
