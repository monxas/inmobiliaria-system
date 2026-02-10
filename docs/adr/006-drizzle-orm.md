# ADR-006: Drizzle ORM for Type-Safe Data Access

## Status

Accepted

## Date

2026-02-10

## Context

We need an ORM or query builder for PostgreSQL that:
1. **Type-safe** — catches errors at compile time
2. **Performant** — minimal runtime overhead
3. **Flexible** — supports raw SQL when needed
4. **Migration support** — schema versioning
5. **Bun compatible** — works with our runtime

Options considered: Drizzle, Prisma, Kysely, TypeORM.

## Decision

Use **Drizzle ORM** as the data access layer.

## Consequences

### Positive
- **100% type-safe** — schema defines TypeScript types automatically
- **SQL-like syntax** — familiar to developers who know SQL
- **Zero runtime overhead** — no query parsing at runtime
- **Bun native** — excellent compatibility with Bun runtime
- **Flexible** — easily drop to raw SQL with `sql` template
- **Lightweight** — ~40KB bundle size vs ~300KB+ for alternatives
- **Built-in migrations** — drizzle-kit for schema management

### Negative
- **Younger project** — less battle-tested than Prisma/TypeORM
- **Smaller community** — fewer tutorials, examples
- **Learning curve** — different paradigm from ActiveRecord-style ORMs
- **No auto-relations** — must explicitly define joins

### Neutral
- Schema defined in TypeScript (not Prisma schema language)
- Can use Drizzle Studio for database exploration
- Migration files are pure SQL

## Schema Definition Pattern

```typescript
// src/database/schema/users.ts
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').withTimezone().defaultNow(),
  updatedAt: timestamp('updated_at').withTimezone().defaultNow(),
  deletedAt: timestamp('deleted_at').withTimezone(),
})

// TypeScript types automatically inferred
export type User = InferSelectModel<typeof users>
export type CreateUser = InferInsertModel<typeof users>
```

## Query Examples

```typescript
// Simple select
const allUsers = await db.select().from(users)

// With filters
const activeAgents = await db
  .select()
  .from(users)
  .where(and(
    eq(users.role, 'agent'),
    isNull(users.deletedAt)
  ))

// Join
const propertiesWithOwner = await db
  .select({
    property: properties,
    owner: users,
  })
  .from(properties)
  .leftJoin(users, eq(properties.ownerId, users.id))

// Insert
const [newUser] = await db
  .insert(users)
  .values({ email, passwordHash, fullName })
  .returning()

// Update
await db
  .update(users)
  .set({ updatedAt: new Date() })
  .where(eq(users.id, userId))
```

## Migration Workflow

```bash
# Generate migration from schema changes
bunx drizzle-kit generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio for visual database exploration
bun run db:studio
```

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Prisma | Great DX, auto-migrations, large community | Larger bundle, Prisma schema file, query engine overhead | Performance and bundle size |
| Kysely | Very lightweight, pure query builder | No migrations, less type inference | Missing migration support |
| TypeORM | Mature, decorators, ActiveRecord style | Heavy, slower, class-based entities | Runtime overhead, complexity |
| Raw pg | Maximum control | No type safety, manual SQL | Developer experience |

## Performance Comparison

| Metric | Drizzle | Prisma | TypeORM |
|--------|---------|--------|---------|
| Bundle size | ~40KB | ~300KB | ~500KB |
| Cold start | ~20ms | ~100ms | ~150ms |
| Simple query | ~0.5ms | ~1.5ms | ~2ms |
| Type inference | Full | Full | Partial |

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle vs Prisma Comparison](https://orm.drizzle.team/docs/benchmarks)
- [Drizzle PostgreSQL Guide](https://orm.drizzle.team/docs/get-started-postgresql)
