/**
 * @fileoverview Properties controller with type-safe validation.
 */

import { CRUDController } from './base/crud.controller'
import { propertiesService } from '../services/properties.service'
import type { Property } from '../database/schema'
import { 
  CreatePropertySchema, 
  UpdatePropertySchema,
  PropertyFiltersSchema,
  type CreatePropertyInput, 
  type UpdatePropertyInput, 
  type PropertyFilters 
} from '../validation/schemas'

/**
 * Controller for property CRUD operations.
 */
export class PropertiesController extends CRUDController<
  Property,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyFilters
> {
  protected override readonly service = propertiesService
  protected override readonly createSchema = CreatePropertySchema
  protected override readonly updateSchema = UpdatePropertySchema
  protected override readonly filtersSchema = PropertyFiltersSchema

  protected override get resourceName(): string {
    return 'Property'
  }
}

/** Singleton controller instance */
export const propertiesController = new PropertiesController()
