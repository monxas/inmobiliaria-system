# ADR-007: Hono as HTTP Framework

## Status

Accepted

## Date

2026-02-10

## Context

We need an HTTP framework for building the REST API. Requirements:
1. **Lightweight** — minimal overhead for NAS deployment
2. **Fast** — high request throughput
3. **TypeScript native** — first-class TS support
4. **Middleware ecosystem** — common patterns available
5. **Bun compatible** — optimized for our runtime
6. **Standards-based** — uses Web Standards (Request/Response)

## Decision

Use **Hono** as the HTTP framework for the backend API.

## Consequences

### Positive
- **Ultra-lightweight** — ~20KB minified
- **Blazing fast** — fastest Web Standards-based framework
- **Bun optimized** — specifically tuned for Bun runtime
- **Web Standards** — uses native Request/Response objects
- **Rich middleware** — CORS, JWT, rate limiting, logging built-in
- **Type-safe** — excellent TypeScript integration
- **Edge-ready** — runs on Cloudflare Workers, Deno, Node, Bun

### Negative
- **Smaller community** — newer than Express, Fastify
- **Less documentation** — fewer Stack Overflow answers
- **Breaking changes** — API still evolving (pre-1.0 until recently)
- **Express middleware incompatible** — different API

### Neutral
- Similar to Express in concept (middleware chain)
- Can run on multiple runtimes if needed
- Growing ecosystem of first-party middleware

## Middleware Stack Pattern

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { logger } from 'hono/logger'

const app = new Hono()

// Middleware applied in order
app.use('*', logger())
app.use('*', cors())
app.use('/api/*', jwt({ secret: JWT_SECRET }))

// Routes
app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('/api/properties', propertiesRoutes)
```

## Route Definition Pattern

```typescript
// routes/properties.ts
import { Hono } from 'hono'
import { propertiesController } from '../controllers'

const properties = new Hono()

properties.get('/', (c) => propertiesController.findAll(c))
properties.get('/:id', (c) => propertiesController.findById(c))
properties.post('/', requireAuth(), requireRole(['admin', 'agent']), (c) => propertiesController.create(c))
properties.put('/:id', requireAuth(), requireRole(['admin', 'agent']), (c) => propertiesController.update(c))
properties.delete('/:id', requireAuth(), requireRole(['admin', 'agent']), (c) => propertiesController.delete(c))

export { properties }
```

## Context and Variables

```typescript
// Type-safe context variables
type AppVariables = {
  user: AuthUser | undefined
  requestId: string
}

const app = new Hono<{ Variables: AppVariables }>()

// In middleware
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID())
  await next()
})

// In handler
app.get('/me', (c) => {
  const user = c.get('user')
  return c.json(user)
})
```

## Performance Benchmarks

Requests per second (simple JSON response):

| Framework | Bun | Node.js |
|-----------|-----|---------|
| Hono | 150,000 | 60,000 |
| Fastify | N/A | 50,000 |
| Express | N/A | 15,000 |
| Elysia | 170,000 | N/A |

*Note: Hono + Bun is our stack, performance is excellent*

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Express | Huge ecosystem, well documented | Old, slow, callback-based | Performance, no TypeScript native |
| Fastify | Fast, schema validation, good TS | Node-only, more complex | Bun optimization |
| Elysia | Fastest on Bun, great DX | Bun-only, very new | Portability concerns |
| tRPC | End-to-end type safety | Not REST, specific client needed | We want standard REST API |

## Future Considerations

- Could migrate to Elysia if we commit to Bun-only
- OpenAPI generation via `@hono/swagger-ui` or `@hono/zod-openapi`
- Built-in validation with `@hono/zod-validator`

## References

- [Hono Documentation](https://hono.dev/)
- [Hono GitHub](https://github.com/honojs/hono)
- [Hono Middleware](https://hono.dev/middleware)
- [Web Standard Benchmarks](https://github.com/nicolo-ribaudo/web-frameworks-benchmark)
