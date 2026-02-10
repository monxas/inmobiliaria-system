import { and, eq, gte, lte, ilike, isNull, type SQL } from 'drizzle-orm'
import { CRUDRepository } from './base/crud.repository'
import { db, type Database } from '../database/connection'
import { properties, type Property } from '../database/schema'
import type { PropertyFilters } from '../validation/schemas'

export class PropertiesRepository extends CRUDRepository<Property> {
  table = properties
  db: Database = db

  protected buildWhereClause(filters: PropertyFilters): SQL | undefined {
    const conditions: SQL[] = []

    if (filters.city) {
      conditions.push(ilike(properties.city, `%${filters.city}%`))
    }

    if (filters.propertyType) {
      conditions.push(eq(properties.propertyType, filters.propertyType))
    }

    if (filters.status) {
      conditions.push(eq(properties.status, filters.status))
    }

    if (filters.minPrice) {
      conditions.push(gte(properties.price, String(filters.minPrice)))
    }

    if (filters.maxPrice) {
      conditions.push(lte(properties.price, String(filters.maxPrice)))
    }

    if (filters.minBedrooms) {
      conditions.push(gte(properties.bedrooms, filters.minBedrooms))
    }

    if (filters.minSurface) {
      conditions.push(gte(properties.surfaceArea, filters.minSurface))
    }

    if (filters.ownerId) {
      conditions.push(eq(properties.ownerId, filters.ownerId))
    }

    if (filters.agentId) {
      conditions.push(eq(properties.agentId, filters.agentId))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  protected get hasSoftDelete(): boolean {
    return true
  }
}

export const propertiesRepository = new PropertiesRepository()
