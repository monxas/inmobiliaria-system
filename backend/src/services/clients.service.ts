/**
 * @fileoverview Clients service with business logic.
 */

import { CRUDService } from './base/crud.service'
import { clientsRepository } from '../repositories/clients.repository'
import type { Client } from '../database/schema'
import type { CreateClientInput, UpdateClientInput, ClientFilters } from '../validation/schemas'
import { ConflictError } from '../types/errors'

/**
 * Service for client business logic.
 */
export class ClientsService extends CRUDService<
  Client,
  CreateClientInput,
  UpdateClientInput,
  ClientFilters
> {
  protected override repository = clientsRepository

  protected override get resourceName(): string {
    return 'Client'
  }

  /**
   * Validate and process create input.
   * Checks for duplicate email.
   */
  protected override async processCreateInput(input: CreateClientInput): Promise<CreateClientInput> {
    if (input.email) {
      const existing = await this.repository.findByEmail(input.email)
      if (existing) {
        throw new ConflictError('Client', 'email', input.email)
      }
    }
    return input
  }

  /**
   * Validate and process update input.
   * Checks for duplicate email if changing.
   */
  protected override async processUpdateInput(
    input: UpdateClientInput, 
    existing: Client
  ): Promise<UpdateClientInput> {
    if (input.email && input.email !== existing.email) {
      const duplicate = await this.repository.findByEmail(input.email)
      if (duplicate) {
        throw new ConflictError('Client', 'email', input.email)
      }
    }
    return input
  }

  /**
   * Find client by email.
   */
  async findByEmail(email: string): Promise<Client | null> {
    return this.repository.findByEmail(email)
  }

  /**
   * Get all clients for an agent.
   */
  async findByAgent(agentId: number): Promise<Client[]> {
    return this.repository.findByAgent(agentId)
  }
}

export const clientsService = new ClientsService()
