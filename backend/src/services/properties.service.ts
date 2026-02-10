import { CRUDService } from './base/crud.service'
import { propertiesRepository, type PropertiesRepository } from '../repositories/properties.repository'
import type { Property } from '../database/schema'
import type { CreatePropertyInput, UpdatePropertyInput, PropertyFilters } from '../validation/schemas'

export class PropertiesService extends CRUDService<
  Property,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilters
> {
  repository: PropertiesRepository = propertiesRepository

  protected processFilters(filters: PropertyFilters): Record<string, any> {
    // Convert string numbers to proper types
    const processed: PropertyFilters = { ...filters }
    
    if (filters.minPrice) {
      processed.minPrice = String(filters.minPrice)
    }
    if (filters.maxPrice) {
      processed.maxPrice = String(filters.maxPrice)
    }
    if (filters.minBedrooms && typeof filters.minBedrooms === 'string') {
      processed.minBedrooms = Number(filters.minBedrooms)
    }
    if (filters.minSurface && typeof filters.minSurface === 'string') {
      processed.minSurface = Number(filters.minSurface)
    }

    return processed
  }

  protected async processCreateInput(input: CreatePropertyInput): Promise<any> {
    return {
      ...input,
      price: String(input.price),
    }
  }

  protected async processUpdateInput(input: UpdatePropertyInput, _existing: Property): Promise<any> {
    const processed = { ...input }
    if (input.price !== undefined) {
      processed.price = String(input.price)
    }
    return processed
  }
}

export const propertiesService = new PropertiesService()
