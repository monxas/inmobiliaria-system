import { NotFoundError } from '../../types/errors'
import type { CRUDRepository } from '../../repositories/base/crud.repository'
import type { PaginatedResult, PaginationMeta } from '../../types'

export abstract class CRUDService<
  TEntity,
  TCreateInput = Record<string, any>,
  TUpdateInput = Record<string, any>,
  TFilters = Record<string, any>
> {
  abstract repository: CRUDRepository<TEntity>

  async findAll(
    filters: TFilters,
    pagination: { page: number; limit: number }
  ): Promise<PaginatedResult<TEntity>> {
    const processedFilters = this.processFilters(filters)
    const offset = (pagination.page - 1) * pagination.limit

    const [data, total] = await Promise.all([
      this.repository.findMany(processedFilters, pagination.limit, offset),
      this.repository.count(processedFilters),
    ])

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    }
  }

  async findById(id: number): Promise<TEntity | null> {
    return this.repository.findById(id)
  }

  async create(input: TCreateInput): Promise<TEntity> {
    const processedInput = await this.processCreateInput(input)
    return this.repository.create(processedInput)
  }

  async update(id: number, input: TUpdateInput): Promise<TEntity> {
    const existing = await this.findById(id)
    if (!existing) throw new NotFoundError('Resource')

    const processedInput = await this.processUpdateInput(input, existing)
    return this.repository.update(id, processedInput)
  }

  async delete(id: number): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) throw new NotFoundError('Resource')

    await this.repository.delete(id)
  }

  // Hook methods — override for custom logic
  protected processFilters(filters: TFilters): Record<string, any> {
    return filters as Record<string, any>
  }

  protected async processCreateInput(input: TCreateInput): Promise<TCreateInput> {
    return input
  }

  protected async processUpdateInput(input: TUpdateInput, _existing: TEntity): Promise<TUpdateInput> {
    return input
  }
}
