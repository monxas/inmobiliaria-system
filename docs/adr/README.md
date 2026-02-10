# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Inmobiliaria System.

## What are ADRs?

ADRs are documents that capture important architectural decisions made along with their context and consequences. They help new team members understand why things are the way they are.

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](001-bun-runtime.md) | Bun as Primary Runtime | Accepted | 2026-02-10 |
| [ADR-002](002-three-layer-architecture.md) | Three-Layer Architecture with Base Classes | Accepted | 2026-02-10 |
| [ADR-003](003-postgresql-over-sqlite.md) | PostgreSQL over SQLite | Accepted | 2026-02-10 |
| [ADR-004](004-jwt-authentication.md) | JWT for Stateless Authentication | Accepted | 2026-02-10 |
| [ADR-005](005-soft-deletes.md) | Soft Deletes for All Entities | Accepted | 2026-02-10 |
| [ADR-006](006-drizzle-orm.md) | Drizzle ORM for Type-Safe Data Access | Accepted | 2026-02-10 |
| [ADR-007](007-hono-framework.md) | Hono as HTTP Framework | Accepted | 2026-02-10 |
| [ADR-008](008-zod-validation.md) | Zod for Runtime Validation | Accepted | 2026-02-10 |

## ADR Status Lifecycle

```
Proposed → Accepted → Deprecated → Superseded
              ↓
           Rejected
```

- **Proposed**: Under discussion
- **Accepted**: Decision has been made and is in effect
- **Rejected**: Decision was considered but not adopted
- **Deprecated**: Decision was once accepted but is no longer relevant
- **Superseded**: Replaced by a newer ADR

## Template

See [template.md](template.md) for the ADR template.
