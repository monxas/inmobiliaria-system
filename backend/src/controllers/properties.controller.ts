import type { Context } from 'hono'
import { CRUDController } from './base/crud.controller'
import { propertiesService, type PropertiesService } from '../services/properties.service'
import type { Property } from '../database/schema'
import { 
  CreatePropertySchema, 
  UpdatePropertySchema,
  type CreatePropertyInput, 
  type UpdatePropertyInput, 
  type PropertyFilters 
} from '../validation/schemas'
import { ValidationError } from '../types/errors'

export class PropertiesController extends CRUDController<
  Property,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilters
> {
  service: PropertiesService = propertiesService

  protected validateCreateInput(input: any): CreatePropertyInput {
    const result = CreatePropertySchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  protected validateUpdateInput(input: any): UpdatePropertyInput {
    const result = UpdatePropertySchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  protected parseFilters(query: Record<string, string>): PropertyFilters {
    return {
      city: query.city || undefined,
      propertyType: query.propertyType as any || undefined,
      status: query.status as any || undefined,
      minPrice: query.minPrice || undefined,
      maxPrice: query.maxPrice || undefined,
      minBedrooms: query.minBedrooms ? Number(query.minBedrooms) : undefined,
      minSurface: query.minSurface ? Number(query.minSurface) : undefined,
      ownerId: query.ownerId ? Number(query.ownerId) : undefined,
      agentId: query.agentId ? Number(query.agentId) : undefined,
    }
  }
}

export const propertiesController = new PropertiesController()
