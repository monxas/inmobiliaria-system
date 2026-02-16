/**
 * @fileoverview Clients service with CRM business logic.
 */

import { CRUDService } from './base/crud.service'
import { clientsRepository } from '../repositories/clients.repository'
import type { Client, ClientInteraction, ClientPropertyMatch } from '../database/schema'
import type { CreateClientInput, UpdateClientInput, ClientFilters, CreateInteractionInput } from '../validation/schemas'
import { ConflictError } from '../types/errors'

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

  protected override async processCreateInput(input: CreateClientInput): Promise<CreateClientInput> {
    if (input.email) {
      const existing = await this.repository.findByEmail(input.email)
      if (existing) {
        throw new ConflictError('Client', 'email', input.email)
      }
    }
    return input
  }

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
   * After create, calculate initial lead score.
   */
  async create(input: CreateClientInput): Promise<Client> {
    const client = await super.create(input)
    await this.repository.updateLeadScore(client.id)
    return this.repository.findById(client.id) as Promise<Client>
  }

  /**
   * After update, recalculate lead score.
   */
  async update(id: number, input: UpdateClientInput): Promise<Client> {
    const client = await super.update(id, input)
    await this.repository.updateLeadScore(id)
    return this.repository.findById(id) as Promise<Client>
  }

  async findByEmail(email: string): Promise<Client | null> {
    return this.repository.findByEmail(email)
  }

  async findByAgent(agentId: number): Promise<Client[]> {
    return this.repository.findByAgent(agentId)
  }

  // Interactions
  async addInteraction(input: CreateInteractionInput & { agentId?: number }): Promise<ClientInteraction> {
    return this.repository.addInteraction(input)
  }

  async getInteractions(clientId: number): Promise<ClientInteraction[]> {
    return this.repository.getInteractions(clientId)
  }

  // Property Matching
  async matchProperties(clientId: number): Promise<ClientPropertyMatch[]> {
    return this.repository.matchProperties(clientId)
  }

  async getPropertyMatches(clientId: number): Promise<ClientPropertyMatch[]> {
    return this.repository.getPropertyMatches(clientId)
  }

  // Lead Score
  async recalculateLeadScore(clientId: number): Promise<number> {
    return this.repository.updateLeadScore(clientId)
  }
}

export const clientsService = new ClientsService()
