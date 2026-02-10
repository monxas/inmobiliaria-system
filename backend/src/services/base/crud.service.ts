/**
 * @fileoverview Type-safe base CRUD service layer.
 * 
 * @description
 * Business logic layer between controllers and repositories.
 * Provides:
 * - Input processing hooks
 * - Pagination handling
 * - Entity existence checks
 * - Extensible patterns for custom logic
 * 
 * @example
 * ```typescript
 * class PropertiesService extends CRUDService<Property, CreatePropertyInput, UpdatePropertyInput, PropertyFilters> {
 *   protected repository = propertiesRepository
 * 
 *   protected async processCreateInput(input: CreatePropertyInput) {
 *     // Custom business logic before create
 *     return input
 *   }
 * }
 * ```
 */

import { NotFoundError } from '../../types/errors'
import type { CRUDRepository } from '../../repositories/base/crud.repository'
import type { PaginatedResult, PaginationParams } from '../../types'
import { logger } from '../../lib/logger'

/**
 * Abstract base service providing business logic for CRUD operations.
 * 
 * @typeParam TEntity - The entity type
 * @typeParam TCreateInput - The validated create input type
 * @typeParam TUpdateInput - The validated update input type
 * @typeParam TFilters - The filter type for queries
 */
export abstract class CRUDService<
  TEntity,
  TCreateInput = Record<string, unknown>,
  TUpdateInput = Record<string, unknown>,
  TFilters = Record<string, unknown>
> {
  /** The repository for data access */
  protected abstract repository: CRUDRepository<TEntity, TFilters>

  /** Resource name for error messages */
  protected get resourceName(): string {
    return 'Resource'
  }

  /**
   * Find all entities with pagination.
   * 
   * @param filters - Filter criteria
   * @param pagination - Page and limit
   * @returns Paginated result with metadata
   */
  async findAll(
    filters: TFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<TEntity>> {
    const processedFilters = this.processFilters(filters)
    const { page, limit } = pagination
    const offset = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.repository.findMany(processedFilters, { limit, offset }),
      this.repository.count(processedFilters),
    ])

    const pages = Math.ceil(total / limit)

    return {
      data,
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
   * Find a single entity by ID.
   * 
   * @param id - The entity ID
   * @returns The entity or null
   */
  async findById(id: number): Promise<TEntity | null> {
    return this.repository.findById(id)
  }

  /**
   * Find a single entity by ID or throw NotFoundError.
   * 
   * @param id - The entity ID
   * @returns The entity
   * @throws NotFoundError if not found
   */
  async findByIdOrFail(id: number): Promise<TEntity> {
    const entity = await this.findById(id)
    if (!entity) {
      throw new NotFoundError(this.resourceName, id)
    }
    return entity
  }

  /**
   * Create a new entity.
   * 
   * @param input - The validated create input
   * @returns The created entity
   */
  async create(input: TCreateInput): Promise<TEntity> {
    const processedInput = await this.processCreateInput(input)
    const entity = await this.repository.create(processedInput as any)

    logger.debug(`${this.resourceName} created via service`, {
      id: (entity as { id?: number }).id,
    })

    return entity
  }

  /**
   * Update an existing entity.
   * 
   * @param id - The entity ID
   * @param input - The validated update input
   * @returns The updated entity
   * @throws NotFoundError if entity doesn't exist
   */
  async update(id: number, input: TUpdateInput): Promise<TEntity> {
    const existing = await this.findByIdOrFail(id)
    const processedInput = await this.processUpdateInput(input, existing)
    const entity = await this.repository.update(id, processedInput as any)

    logger.debug(`${this.resourceName} updated via service`, { id })

    return entity
  }

  /**
   * Delete an entity.
   * 
   * @param id - The entity ID
   * @throws NotFoundError if entity doesn't exist
   */
  async delete(id: number): Promise<void> {
    await this.findByIdOrFail(id)
    await this.repository.delete(id)

    logger.debug(`${this.resourceName} deleted via service`, { id })
  }

  /**
   * Check if an entity exists.
   * 
   * @param id - The entity ID
   * @returns True if exists
   */
  async exists(id: number): Promise<boolean> {
    return this.repository.exists(id)
  }

  // ============================================
  // Hook Methods - Override in Subclasses
  // ============================================

  /**
   * Process filters before passing to repository.
   * Override to add custom filter logic.
   * 
   * @param filters - The raw filters
   * @returns Processed filters
   */
  protected processFilters(filters: TFilters): TFilters {
    return filters
  }

  /**
   * Process input before create.
   * Override to add computed fields, defaults, etc.
   * 
   * @param input - The validated input
   * @returns Processed input
   */
  protected async processCreateInput(input: TCreateInput): Promise<TCreateInput> {
    return input
  }

  /**
   * Process input before update.
   * Override to add validation against existing entity, computed fields, etc.
   * 
   * @param input - The validated input
   * @param existing - The existing entity
   * @returns Processed input
   */
  protected async processUpdateInput(
    input: TUpdateInput, 
    _existing: TEntity
  ): Promise<TUpdateInput> {
    return input
  }
}
