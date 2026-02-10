import type { Context } from 'hono'
import { apiResponse, apiError } from '../../utils/response'
import { ValidationError, NotFoundError } from '../../types/errors'
import type { CRUDService } from '../../services/base/crud.service'

export abstract class CRUDController<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TFilters = Record<string, any>
> {
  abstract service: CRUDService<TEntity, TCreateInput, TUpdateInput, TFilters>

  // GET /resources
  async findAll(c: Context) {
    const filters = this.parseFilters(c.req.query())
    const page = Number(c.req.query('page')) || 1
    const limit = Math.min(Number(c.req.query('limit')) || 10, 100)

    try {
      const result = await this.service.findAll(filters, { page, limit })
      return c.json(apiResponse(result.data, { pagination: result.pagination }))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch resources')
    }
  }

  // GET /resources/:id
  async findById(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)

    try {
      const data = await this.service.findById(id)
      if (!data) return c.json(apiError('Resource not found', 404), 404)
      return c.json(apiResponse(data))
    } catch (error) {
      return this.handleError(c, error, 'Failed to fetch resource')
    }
  }

  // POST /resources
  async create(c: Context) {
    try {
      const input = await c.req.json()
      const validatedInput = this.validateCreateInput(input)
      const data = await this.service.create(validatedInput)
      return c.json(apiResponse(data), 201)
    } catch (error) {
      return this.handleError(c, error, 'Failed to create resource')
    }
  }

  // PUT /resources/:id
  async update(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)

    try {
      const input = await c.req.json()
      const validatedInput = this.validateUpdateInput(input)
      const data = await this.service.update(id, validatedInput)
      return c.json(apiResponse(data))
    } catch (error) {
      return this.handleError(c, error, 'Failed to update resource')
    }
  }

  // DELETE /resources/:id
  async delete(c: Context) {
    const id = Number(c.req.param('id'))
    if (!id) return c.json(apiError('Invalid ID', 400), 400)

    try {
      await this.service.delete(id)
      return c.json(apiResponse({ id, deleted: true }))
    } catch (error) {
      return this.handleError(c, error, 'Failed to delete resource')
    }
  }

  // Abstract methods — each controller implements
  protected abstract validateCreateInput(input: any): TCreateInput
  protected abstract validateUpdateInput(input: any): TUpdateInput
  protected abstract parseFilters(query: Record<string, string>): TFilters

  protected handleError(c: Context, error: unknown, defaultMessage: string) {
    if (error instanceof ValidationError) {
      return c.json(apiError(error.message, 400, error.details), 400)
    }
    if (error instanceof NotFoundError) {
      return c.json(apiError(error.message, 404), 404)
    }

    console.error(`${this.constructor.name}:`, error)
    return c.json(apiError(defaultMessage, 500), 500)
  }
}
