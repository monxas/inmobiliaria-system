# ADR-005: Soft Deletes for All Entities

## Status

Accepted

## Date

2026-02-10

## Context

When users delete data, we need to decide between:
1. **Hard delete** — permanently remove from database
2. **Soft delete** — mark as deleted, keep data

This decision affects data recovery, audit trails, referential integrity, and query performance.

## Decision

Implement **soft deletes** for all primary entities (users, properties, clients, documents) using a `deleted_at` timestamp column.

## Consequences

### Positive
- **Data recovery** — accidentally deleted data can be restored
- **Audit trail** — complete history of all records
- **Referential integrity** — foreign keys remain valid
- **Legal compliance** — retain records for required periods
- **User experience** — "undo" functionality is possible
- **Analytics** — historical data available for reporting

### Negative
- **Query complexity** — all queries must filter `WHERE deleted_at IS NULL`
- **Storage growth** — deleted data still consumes space
- **Index overhead** — partial indexes needed for performance
- **Privacy concerns** — "deleted" data still exists (GDPR consideration)
- **Unique constraints** — more complex with soft deletes

### Neutral
- Base repository class automatically adds soft delete filter
- Periodic cleanup job can hard-delete old soft-deleted records
- Admin interface can show/restore deleted items

## Implementation

### Schema Pattern
```sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  -- ... other columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE  -- NULL = not deleted
);

-- Partial index for performance
CREATE INDEX idx_properties_active ON properties(id) WHERE deleted_at IS NULL;
```

### Repository Pattern
```typescript
abstract class CRUDRepository<T> {
  protected readonly hasSoftDelete: boolean = true
  
  async findMany(filters: TFilters): Promise<T[]> {
    const conditions = this.buildConditions(filters)
    
    // Automatically add soft delete filter
    if (this.hasSoftDelete && this.deletedAtColumn) {
      conditions.push(isNull(this.deletedAtColumn))
    }
    
    return this.db.select().from(this.table).where(and(...conditions))
  }
  
  async delete(id: number): Promise<void> {
    if (this.hasSoftDelete) {
      await this.db.update(this.table)
        .set({ deletedAt: new Date() })
        .where(eq(this.idColumn, id))
    } else {
      await this.db.delete(this.table).where(eq(this.idColumn, id))
    }
  }
}
```

### Handling Unique Constraints

For columns that must be unique among active records:
```sql
-- Unique email only for active users
CREATE UNIQUE INDEX idx_users_email_unique 
ON users(email) 
WHERE deleted_at IS NULL;
```

## Cleanup Strategy

Periodic job to hard-delete old records (configurable retention):
```typescript
// Hard delete records deleted more than 90 days ago
async function cleanupDeletedRecords() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  
  await db.delete(users).where(lt(users.deletedAt, cutoff))
  await db.delete(properties).where(lt(properties.deletedAt, cutoff))
  // ... other tables
}
```

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Hard delete only | Simple, clean database, better for privacy | No undo, broken FKs, no audit trail | Too risky for business data |
| Archive table | Separate table for deleted records | Complex sync, duplicate schemas | Maintenance overhead |
| Event sourcing | Complete history, no deletes | Major architectural change, complexity | Over-engineering for this project |

## GDPR Consideration

For GDPR "right to be forgotten":
1. Soft delete immediately (user sees record as deleted)
2. Hard delete after mandatory retention period (e.g., 30 days)
3. Anonymous related audit logs if needed

## References

- [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [Soft Delete Anti-Pattern?](https://jameshalsall.co.uk/posts/soft-delete-anti-pattern)
- [Why Soft Deletes are a Good Idea](https://www.brentozar.com/archive/2020/02/soft-deletes-are-a-good-idea/)
