import { eq, isNull, sql, type SQL } from 'drizzle-orm'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import type { Database } from '../../database/connection'

export abstract class CRUDRepository<TEntity> {
  abstract table: PgTableWithColumns<any>
  abstract db: Database

  async findMany(
    filters: Record<string, any> = {},
    limit: number = 10,
    offset: number = 0
  ): Promise<TEntity[]> {
    const conditions: SQL[] = []

    if (Object.keys(filters).length > 0) {
      const where = this.buildWhereClause(filters)
      if (where) conditions.push(where)
    }

    if (this.hasSoftDelete) {
      conditions.push(isNull((this.table as any).deleted_at))
    }

    let query = this.db.select().from(this.table).limit(limit).offset(offset)

    for (const condition of conditions) {
      query = query.where(condition) as any
    }

    return query as unknown as TEntity[]
  }

  async findById(id: number): Promise<TEntity | null> {
    const conditions: SQL[] = [eq((this.table as any).id, id)]

    if (this.hasSoftDelete) {
      conditions.push(isNull((this.table as any).deleted_at))
    }

    let query = this.db.select().from(this.table).limit(1)
    for (const condition of conditions) {
      query = query.where(condition) as any
    }

    const result = await query
    return (result[0] as TEntity) || null
  }

  async create(data: any): Promise<TEntity> {
    const result = await this.db
      .insert(this.table)
      .values(data)
      .returning()

    return result[0] as TEntity
  }

  async update(id: number, data: any): Promise<TEntity> {
    const result = await this.db
      .update(this.table)
      .set({ ...data, updated_at: new Date() })
      .where(eq((this.table as any).id, id))
      .returning()

    return result[0] as TEntity
  }

  async delete(id: number): Promise<void> {
    if (this.hasSoftDelete) {
      await this.db
        .update(this.table)
        .set({ deleted_at: new Date() } as any)
        .where(eq((this.table as any).id, id))
    } else {
      await this.db
        .delete(this.table)
        .where(eq((this.table as any).id, id))
    }
  }

  async count(filters: Record<string, any> = {}): Promise<number> {
    const conditions: SQL[] = []

    if (Object.keys(filters).length > 0) {
      const where = this.buildWhereClause(filters)
      if (where) conditions.push(where)
    }

    if (this.hasSoftDelete) {
      conditions.push(isNull((this.table as any).deleted_at))
    }

    let query = this.db.select({ count: sql<number>`count(*)::int` }).from(this.table)
    for (const condition of conditions) {
      query = query.where(condition) as any
    }

    const result = await query
    return Number(result[0].count)
  }

  protected abstract buildWhereClause(filters: Record<string, any>): SQL | undefined
  protected get hasSoftDelete(): boolean {
    return true
  }
}
