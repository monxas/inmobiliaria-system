/**
 * @fileoverview Properties service with business logic.
 */

import { CRUDService } from './base/crud.service'
import { propertiesRepository } from '../repositories/properties.repository'
import type { Property } from '../database/schema'
import type { CreatePropertyInput, UpdatePropertyInput, PropertyFilters } from '../validation/schemas'

/**
 * Service for property business logic.
 */
export class PropertiesService extends CRUDService<
  Property,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilters
> {
  protected override repository = propertiesRepository

  protected override get resourceName(): string {
    return 'Property'
  }

  /**
   * Process filters before query.
   * Ensures price values are numbers for comparison.
   */
  protected override processFilters(filters: PropertyFilters): PropertyFilters {
    const processed: PropertyFilters = { ...filters }
    
    // Ensure price filters are numbers for comparison
    if (filters.minPrice !== undefined) {
      processed.minPrice = Number(filters.minPrice)
    }
    if (filters.maxPrice !== undefined) {
      processed.maxPrice = Number(filters.maxPrice)
    }
    if (filters.minBedrooms !== undefined) {
      processed.minBedrooms = Number(filters.minBedrooms)
    }
    if (filters.maxBedrooms !== undefined) {
      processed.maxBedrooms = Number(filters.maxBedrooms)
    }
    if (filters.minSurface !== undefined) {
      processed.minSurface = Number(filters.minSurface)
    }

    return processed
  }

  /**
   * Process create input.
   * Ensures price is stored as string (for decimal column).
   */
  protected override async processCreateInput(input: CreatePropertyInput): Promise<CreatePropertyInput> {
    return {
      ...input,
      price: String(input.price),
    }
  }

  /**
   * Process update input.
   * Ensures price is stored as string if present.
   */
  protected override async processUpdateInput(
    input: UpdatePropertyInput, 
    _existing: Property
  ): Promise<UpdatePropertyInput> {
    if (input.price !== undefined) {
      return {
        ...input,
        price: String(input.price),
      }
    }
    return input
  }

  /**
   * Get properties by owner ID.
   */
  async findByOwner(ownerId: number): Promise<Property[]> {
    return this.repository.findByOwner(ownerId)
  }

  /**
   * Get properties by agent ID.
   */
  async findByAgent(agentId: number): Promise<Property[]> {
    return this.repository.findByAgent(agentId)
  }
}

export const propertiesService = new PropertiesService()
