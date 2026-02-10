/**
 * @fileoverview Clients controller with type-safe validation.
 */

import { CRUDController } from './base/crud.controller'
import { clientsService } from '../services/clients.service'
import type { Client } from '../database/schema'
import { 
  CreateClientSchema, 
  UpdateClientSchema,
  ClientFiltersSchema,
  type CreateClientInput, 
  type UpdateClientInput, 
  type ClientFilters 
} from '../validation/schemas'

/**
 * Controller for client CRUD operations.
 */
export class ClientsController extends CRUDController<
  Client,
  CreateClientInput,
  UpdateClientInput,
  ClientFilters
> {
  protected override readonly service = clientsService
  protected override readonly createSchema = CreateClientSchema
  protected override readonly updateSchema = UpdateClientSchema
  protected override readonly filtersSchema = ClientFiltersSchema

  protected override get resourceName(): string {
    return 'Client'
  }
}

/** Singleton controller instance */
export const clientsController = new ClientsController()
