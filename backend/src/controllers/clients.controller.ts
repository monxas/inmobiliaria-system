/**
 * @fileoverview Clients controller with CRM endpoints.
 */

import type { Context } from 'hono'
import { CRUDController } from './base/crud.controller'
import { clientsService } from '../services/clients.service'
import type { Client } from '../database/schema'
import { 
  CreateClientSchema, 
  UpdateClientSchema,
  ClientFiltersSchema,
  CreateInteractionSchema,
  type CreateClientInput, 
  type UpdateClientInput, 
  type ClientFilters 
} from '../validation/schemas'

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

  /** POST /clients/:id/interactions */
  async addInteraction(c: Context) {
    const clientId = Number(c.req.param('id'))
    const body = await c.req.json()
    const input = CreateInteractionSchema.parse({ ...body, clientId })
    const user = c.get('user')
    const interaction = await clientsService.addInteraction({ ...input, agentId: user?.id })
    return c.json({ success: true, data: interaction }, 201)
  }

  /** GET /clients/:id/interactions */
  async getInteractions(c: Context) {
    const clientId = Number(c.req.param('id'))
    const interactions = await clientsService.getInteractions(clientId)
    return c.json({ success: true, data: interactions })
  }

  /** POST /clients/:id/match-properties */
  async matchProperties(c: Context) {
    const clientId = Number(c.req.param('id'))
    const matches = await clientsService.matchProperties(clientId)
    return c.json({ success: true, data: matches })
  }

  /** GET /clients/:id/matches */
  async getPropertyMatches(c: Context) {
    const clientId = Number(c.req.param('id'))
    const matches = await clientsService.getPropertyMatches(clientId)
    return c.json({ success: true, data: matches })
  }

  /** POST /clients/:id/recalculate-score */
  async recalculateScore(c: Context) {
    const clientId = Number(c.req.param('id'))
    const score = await clientsService.recalculateLeadScore(clientId)
    return c.json({ success: true, data: { leadScore: score } })
  }
}

export const clientsController = new ClientsController()
