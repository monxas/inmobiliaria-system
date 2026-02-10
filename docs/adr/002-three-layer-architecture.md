# ADR-002: Three-Layer Architecture with Base Classes

## Status

Accepted

## Date

2026-02-10

## Context

We need a code architecture that:
1. Separates concerns (HTTP handling, business logic, data access)
2. Reduces boilerplate for CRUD operations (80% of endpoints)
3. Maintains type safety throughout the stack
4. Allows for testing at each layer
5. Can be understood by developers with varying experience levels

## Decision

Adopt a **Three-Layer Architecture** with abstract base classes for CRUD operations:

```
Controller Layer → Service Layer → Repository Layer → Database
```

Each layer has an abstract base class that implements common CRUD patterns:
- `CRUDController<TEntity, TCreate, TUpdate, TFilters>`
- `CRUDService<TEntity, TCreate, TUpdate, TFilters>`
- `CRUDRepository<TEntity, TFilters>`

Resource-specific implementations extend these base classes and override only what's different.

## Consequences

### Positive
- **DRY code** — 80% reduction in boilerplate for standard CRUD endpoints
- **Consistent patterns** — all resources follow the same conventions
- **Easy onboarding** — new developers learn one pattern, apply everywhere
- **Type safety** — generic types ensure consistency at compile time
- **Testable** — each layer can be tested in isolation
- **Extensible** — hooks (processCreateInput, buildWhereClause) allow customization

### Negative
- **Learning curve** — developers need to understand TypeScript generics
- **Abstraction overhead** — debugging may require navigating through base classes
- **Potential over-engineering** — simple endpoints don't need all layers
- **Tight coupling** to the pattern — changing base class affects all resources

### Neutral
- Controllers are thin (validation + delegation)
- Services handle business logic and hooks
- Repositories are pure data access
- Validation happens at controller level via Zod schemas

## Layer Responsibilities

| Layer | Responsibility | Dependencies |
|-------|---------------|--------------|
| **Controller** | HTTP handling, validation, response formatting | Service, Zod schemas |
| **Service** | Business logic, data transformation, hooks | Repository |
| **Repository** | Data access, query building | Drizzle ORM, Database |

## Template Method Pattern

The base classes use the Template Method pattern:

```typescript
// Base service
abstract class CRUDService<T, TCreate, TUpdate> {
  async create(input: TCreate): Promise<T> {
    const processed = await this.processCreateInput(input)  // Hook
    return this.repository.create(processed)
  }
  
  // Override in subclass for custom logic
  protected async processCreateInput(input: TCreate): Promise<TCreate> {
    return input
  }
}

// Concrete implementation
class PropertiesService extends CRUDService<Property, CreateProperty, UpdateProperty> {
  protected async processCreateInput(input: CreateProperty) {
    return { ...input, status: input.status ?? 'available' }
  }
}
```

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Flat structure (no layers) | Simple, no abstraction | Code duplication, hard to test, no separation of concerns | Not maintainable at scale |
| Clean Architecture | Very decoupled, hexagonal ports | Over-engineering for this project size | Too much ceremony |
| MVC with fat models | Rails-style, familiar | Models become bloated, hard to test | Business logic scattered |

## References

- [Martin Fowler - Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Template Method Pattern](https://refactoring.guru/design-patterns/template-method)
