import type { Context } from 'hono'
import { CRUDController } from './base/crud.controller'
import { clientsService, type ClientsService } from '../services/clients.service'
import type { Client } from '../database/schema'
import { 
  CreateClientSchema, 
  UpdateClientSchema,
  type CreateClientInput, 
  type UpdateClientInput, 
  type ClientFilters 
} from '../validation/schemas'
import { ValidationError } from '../types/errors'

export class ClientsController extends CRUDController<
  Client,
  CreateClientInput,
  UpdateClientInput,
  ClientFilters
> {
  service: ClientsService = clientsService

  protected validateCreateInput(input: any): CreateClientInput {
    const result = CreateClientSchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  protected validateUpdateInput(input: any): UpdateClientInput {
    const result = UpdateClientSchema.safeParse(input)
    if (!result.success) {
      const error = result.error.errors[0]
      throw new ValidationError(error.path.join('.'), error.message)
    }
    return result.data
  }

  protected parseFilters(query: Record<string, string>): ClientFilters {
    return {
      fullName: query.fullName || undefined,
      email: query.email || undefined,
      agentId: query.agentId ? Number(query.agentId) : undefined,
    }
  }
}

export const clientsController = new ClientsController()
