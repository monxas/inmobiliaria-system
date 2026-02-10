/**
 * @fileoverview Type-safe base CRUD repository using Drizzle ORM.
 * 
 * @description
 * Provides standard CRUD operations with support for:
 * - Soft deletes (optional)
 * - Pagination
 * - Dynamic filtering
 */

import { and, eq, isNull, count, type SQL } from 'drizzle-orm'
import type { PgTableWithColumns, PgColumn } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { logger } from '../../lib/logger'
import { DatabaseError } from '../../types/errors'

/**
 * Query options for findMany.
 */
export interface QueryOptions {
  limit?: number
  offset?: number
}

/**
 * Abstract base repository providing type-safe CRUD operations.
 * 
 * @typeParam TEntity - The entity type returned by queries
 * @typeParam TFilters - The filter object type for queries
 */
export abstract class CRUDRepository<
  TEntity,
  TFilters = Record<string, unknown>
> {
  /** The Drizzle table object */
  protected abstract readonly table: PgTableWithColumns<any>
  
  /** Database connection */
  protected abstract readonly db: PostgresJsDatabase
  
  /** Whether this entity uses soft deletes */
  protected readonly hasSoftDelete: boolean = true

  /**
   * Get the primary key column.
   */
  protected get idColumn(): PgColumn<any, any, any> {
    return (this.table as any).id
  }

  /**
   * Get the deleted_at column (for soft deletes).
   */
  protected get deletedAtColumn(): PgColumn<any, any, any> | null {
    return (this.table as any).deletedAt ?? null
  }

  /**
   * Get the updated_at column.
   */
  protected get updatedAtColumn(): PgColumn<any, any, any> | null {
    return (this.table as any).updatedAt ?? null
  }

  /**
   * Find multiple entities with optional filtering and pagination.
   */
  async findMany(
    filters: TFilters = {} as TFilters,
    options: QueryOptions = {}
  ): Promise<TEntity[]> {
    const { limit = 10, offset = 0 } = options
    
    try {
      const conditions = this.buildConditions(filters)
      
      const results = await this.db
        .select()
        .from(this.table)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit)
        .offset(offset)

      return results as TEntity[]
    } catch (error) {
      logger.error('Repository findMany error', { 
        repository: this.constructor.name,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new DatabaseError('Failed to fetch records', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Find a single entity by ID.
   */
  async findById(id: number): Promise<TEntity | null> {
    try {
      const conditions: SQL[] = [eq(this.idColumn, id)]

      if (this.hasSoftDelete && this.deletedAtColumn) {
        conditions.push(isNull(this.deletedAtColumn))
      }

      const results = await this.db
        .select()
        .from(this.table)
        .where(and(...conditions))
        .limit(1)

      return (results[0] as TEntity) ?? null
    } catch (error) {
      logger.error('Repository findById error', { 
        repository: this.constructor.name,
        id,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new DatabaseError('Failed to fetch record', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Create a new entity.
   */
  async create(data: Record<string, unknown>): Promise<TEntity> {
    try {
      const results = await this.db
        .insert(this.table)
        .values(data as any)
        .returning()

      logger.debug('Entity created', { 
        repository: this.constructor.name, 
        id: (results[0] as { id?: number })?.id 
      })

      return results[0] as TEntity
    } catch (error) {
      logger.error('Repository create error', { 
        repository: this.constructor.name,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new DatabaseError('Failed to create record', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Update an existing entity.
   */
  async update(id: number, data: Record<string, unknown>): Promise<TEntity> {
    try {
      const updateData = this.updatedAtColumn
        ? { ...data, updatedAt: new Date() }
        : data

      const results = await this.db
        .update(this.table)
        .set(updateData as any)
        .where(eq(this.idColumn, id))
        .returning()

      logger.debug('Entity updated', { repository: this.constructor.name, id })

      return results[0] as TEntity
    } catch (error) {
      logger.error('Repository update error', { 
        repository: this.constructor.name,
        id,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new DatabaseError('Failed to update record', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Delete an entity (soft delete if configured, otherwise hard delete).
   */
  async delete(id: number): Promise<void> {
    try {
      if (this.hasSoftDelete && this.deletedAtColumn) {
        await this.db
          .update(this.table)
          .set({ deletedAt: new Date() } as any)
          .where(eq(this.idColumn, id))
        
        logger.debug('Entity soft deleted', { repository: this.constructor.name, id })
      } else {
        await this.db
          .delete(this.table)
          .where(eq(this.idColumn, id))
        
        logger.debug('Entity hard deleted', { repository: this.constructor.name, id })
      }
    } catch (error) {
      logger.error('Repository delete error', { 
        repository: this.constructor.name,
        id,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new DatabaseError('Failed to delete record', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Count entities matching the given filters.
   */
  async count(filters: TFilters = {} as TFilters): Promise<number> {
    try {
      const conditions = this.buildConditions(filters)

      const result = await this.db
        .select({ count: count() })
        .from(this.table)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      return Number(result[0]?.count ?? 0)
    } catch (error) {
      logger.error('Repository count error', { 
        repository: this.constructor.name,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new DatabaseError('Failed to count records', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Check if an entity with the given ID exists.
   */
  async exists(id: number): Promise<boolean> {
    const entity = await this.findById(id)
    return entity !== null
  }

  /**
   * Build combined conditions including soft delete filter.
   */
  private buildConditions(filters: TFilters): SQL[] {
    const conditions: SQL[] = []

    // Add filter conditions
    const filterCondition = this.buildWhereClause(filters)
    if (filterCondition) {
      conditions.push(filterCondition)
    }

    // Add soft delete condition
    if (this.hasSoftDelete && this.deletedAtColumn) {
      conditions.push(isNull(this.deletedAtColumn))
    }

    return conditions
  }

  /**
   * Build WHERE clause from filter object.
   * Override in subclass to implement custom filtering.
   */
  protected abstract buildWhereClause(filters: TFilters): SQL | undefined
}
