import { CRUDService } from './base/crud.service'
import { clientsRepository, type ClientsRepository } from '../repositories/clients.repository'
import type { Client } from '../database/schema'
import type { CreateClientInput, UpdateClientInput, ClientFilters } from '../validation/schemas'
import { ValidationError } from '../types/errors'

export class ClientsService extends CRUDService<
  Client,
  CreateClientInput,
  UpdateClientInput,
  ClientFilters
> {
  repository: ClientsRepository = clientsRepository

  protected async processCreateInput(input: CreateClientInput): Promise<any> {
    // Check for duplicate email if provided
    if (input.email) {
      const existing = await this.repository.findByEmail(input.email)
      if (existing) {
        throw new ValidationError('email', 'A client with this email already exists')
      }
    }
    return input
  }

  protected async processUpdateInput(input: UpdateClientInput, existing: Client): Promise<any> {
    // Check for duplicate email if changing
    if (input.email && input.email !== existing.email) {
      const duplicate = await this.repository.findByEmail(input.email)
      if (duplicate) {
        throw new ValidationError('email', 'A client with this email already exists')
      }
    }
    return input
  }

  async findByEmail(email: string): Promise<Client | null> {
    return this.repository.findByEmail(email)
  }
}

export const clientsService = new ClientsService()
