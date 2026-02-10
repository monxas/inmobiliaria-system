# ADR-008: Zod for Runtime Validation

## Status

Accepted

## Date

2026-02-10

## Context

TypeScript provides compile-time type safety, but runtime data (HTTP requests, database results, external APIs) must be validated at runtime. We need a validation library that:

1. **Type inference** — generates TypeScript types from schemas
2. **Composable** — schemas can be composed and extended
3. **Good errors** — clear validation error messages
4. **Lightweight** — minimal bundle impact
5. **Parse, don't validate** — transforms data during validation

## Decision

Use **Zod** for all runtime validation including:
- Request body validation
- Query parameter parsing
- Environment variable validation
- Configuration validation

## Consequences

### Positive
- **Type inference** — `z.infer<typeof schema>` generates types automatically
- **Parse transforms** — coerces strings to numbers, trims whitespace, etc.
- **Composable** — `.extend()`, `.pick()`, `.omit()`, `.merge()` for schema composition
- **Clear errors** — structured error objects with paths
- **No duplication** — one source of truth for types and validation
- **Tree-shakeable** — only include what you use

### Negative
- **Runtime cost** — validation adds ~1-2ms per request
- **Learning curve** — different API from Joi, Yup
- **Bundle size** — ~50KB (smaller than alternatives)

### Neutral
- Integrates with Hono via `@hono/zod-validator`
- Can generate OpenAPI schemas with `@anatine/zod-openapi`
- Works with both sync and async validation

## Schema Patterns

### Basic Schema Definition
```typescript
import { z } from 'zod'

export const createPropertySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1).max(100),
  postalCode: z.string().optional(),
  propertyType: z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']),
  status: z.enum(['available', 'reserved', 'sold', 'rented', 'off_market']).default('available'),
  price: z.coerce.number().positive(),  // Coerce string to number
  surfaceArea: z.coerce.number().int().positive().optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),
  garage: z.boolean().default(false),
  garden: z.boolean().default(false),
})

// Type is automatically inferred
export type CreatePropertyInput = z.infer<typeof createPropertySchema>
```

### Schema Composition
```typescript
// Base schema
const propertyBase = z.object({
  title: z.string(),
  address: z.string(),
  price: z.number().positive(),
})

// Create = required fields
const createProperty = propertyBase.extend({
  propertyType: z.enum(['house', 'apartment']),
})

// Update = all optional
const updateProperty = propertyBase.partial()

// Filters = optional with coercion for query params
const propertyFilters = z.object({
  city: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
})
```

### Validation in Controller
```typescript
protected validateCreateInput(input: unknown): TCreateInput {
  const result = this.createSchema.safeParse(input)
  
  if (!result.success) {
    const firstError = result.error.errors[0]
    throw new ValidationError(
      firstError.path.join('.'),
      firstError.message,
      { zodErrors: result.error.errors }
    )
  }
  
  return result.data
}
```

## Error Format

```json
{
  "success": false,
  "error": {
    "message": "Validation failed: price must be positive",
    "code": 400,
    "details": {
      "field": "price",
      "zodErrors": [
        {
          "code": "too_small",
          "minimum": 0,
          "type": "number",
          "inclusive": false,
          "exact": false,
          "message": "Number must be greater than 0",
          "path": ["price"]
        }
      ]
    }
  }
}
```

## Environment Validation

```typescript
// src/config/env.ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().transform(s => s.split(',')),
})

export const env = envSchema.parse(process.env)
```

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Joi | Mature, expressive | No TypeScript inference, larger bundle | No type inference |
| Yup | Good TS support, familiar API | Slower, bigger bundle | Zod is lighter, faster |
| class-validator | Decorator-based, integrates with class-transformer | Class-based, requires decorators | Doesn't fit functional style |
| io-ts | Functional, rigorous | Steep learning curve, verbose | Developer experience |
| Valibot | Smaller than Zod | Very new, less ecosystem | Maturity concerns |

## Performance

| Operation | Zod | Joi | Yup |
|-----------|-----|-----|-----|
| Simple object | 0.05ms | 0.12ms | 0.08ms |
| Complex nested | 0.15ms | 0.35ms | 0.25ms |
| Bundle size | ~50KB | ~120KB | ~80KB |

## References

- [Zod Documentation](https://zod.dev/)
- [Zod GitHub](https://github.com/colinhacks/zod)
- [Parse, Don't Validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
- [Hono Zod Validator](https://hono.dev/docs/guides/validation#with-zod)
