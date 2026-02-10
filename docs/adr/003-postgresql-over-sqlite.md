# ADR-003: PostgreSQL over SQLite

## Status

Accepted

## Date

2026-02-10

## Context

We need a database for persistent storage. The deployment target is a self-hosted NAS environment with the following requirements:

1. **ACID compliance** — data integrity is critical
2. **Concurrent access** — multiple users accessing simultaneously
3. **JSON support** — for flexible property features/metadata
4. **Full-text search** — future property search capability
5. **Reasonable resource usage** — NAS has limited RAM (4-8GB)

Initial design considered SQLite for simplicity, but this was revisited during auditing.

## Decision

Use **PostgreSQL 16 Alpine** as the primary database instead of SQLite.

## Consequences

### Positive
- **True concurrency** — handles multiple writers without WAL contention
- **Robust JSONB support** — indexable, queryable JSON fields
- **Full-text search built-in** — `tsvector` and `tsquery` for property search
- **Enterprise features** — LISTEN/NOTIFY for real-time updates (future)
- **Better Drizzle support** — full feature parity with Drizzle ORM
- **Production proven** — decades of reliability in production systems
- **Connection pooling** — better resource management

### Negative
- **Additional container** — adds ~150MB to the stack
- **More memory** — requires 128-256MB for shared_buffers
- **Network dependency** — backend connects over TCP (adds latency)
- **Backup complexity** — requires pg_dump vs simple file copy
- **Local development** — requires Docker or local PostgreSQL install

### Neutral
- Alpine image is minimal (~150MB vs ~400MB for standard)
- Can use connection pooling (PgBouncer) if scale requires
- Drizzle ORM abstracts most differences from application code

## Resource Allocation

For NAS deployment (4GB RAM):
```
shared_buffers = 128MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 64MB
```

For NAS deployment (8GB+ RAM):
```
shared_buffers = 256MB
effective_cache_size = 2GB
work_mem = 32MB
maintenance_work_mem = 128MB
```

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| SQLite | Zero config, single file, embedded | Single writer, limited JSON, no FTS out of box | Concurrency limitations |
| MySQL/MariaDB | Widely used, good performance | Less advanced features, larger footprint | PostgreSQL has better JSONB |
| MongoDB | Native JSON, flexible schema | No ACID by default, larger footprint, different query paradigm | Overkill, relational model fits better |

## Migration Path

If future requirements exceed PostgreSQL on NAS:
1. Export via pg_dump
2. Import to managed PostgreSQL (Supabase, Neon, AWS RDS)
3. Update DATABASE_URL in environment

No application code changes needed due to Drizzle abstraction.

## References

- [PostgreSQL on Docker](https://hub.docker.com/_/postgres)
- [Drizzle PostgreSQL Driver](https://orm.drizzle.team/docs/get-started-postgresql)
- [PostgreSQL vs SQLite](https://www.prisma.io/dataguide/postgresql/postgresql-vs-sqlite)
