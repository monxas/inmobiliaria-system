# 🤖 AGENTS DEVELOPMENT GUIDE
**Para agentes que trabajarán en el sistema inmobiliaria**

---

## 🎯 MISIÓN Y CONTEXTO

**Proyecto:** Sistema de gestión inmobiliaria self-hosted para NAS  
**Stack:** Bun + Hono + PostgreSQL + SvelteKit  
**Metodología:** "Base sólida" — un nivel a la vez, componentes reutilizables  

**TU ROL:** Implementar código siguiendo specs técnicas exactas, manteniendo calidad y reutilización.

---

## 📋 REGLAS CRÍTICAS

### **🚫 NUNCA HAGAS ESTO**
1. **No cambies el stack** sin aprobación — Bun+Hono+PostgreSQL es decisión final
2. **No pases al siguiente nivel** sin completar el actual 100%
3. **No crees código duplicado** — reutiliza componentes genéricos
4. **No hardcodees** — todo configurable via ENV
5. **No olvides tests** a partir del Nivel 2
6. **No ignores las inconsistencias** resueltas — está documentado qué no usar

### **✅ SIEMPRE HAZ ESTO**  
1. **Lee primero:** `TECH-SPEC.md` + `COMPONENTS.md` + nivel actual
2. **Sigue patrones:** templates en `/templates` son obligatorios
3. **Tests incluidos:** cada feature con su test correspondiente
4. **Documenta APIs:** OpenAPI auto-generado
5. **Type-safety:** TypeScript strict mode
6. **Health checks:** endpoints `/health` en todos los servicios

---

## 🏗️ ARQUITECTURA DE COMPONENTES

### **Backend — Patrón Repository + Service**
```
src/
├── controllers/     # HTTP handlers (thin layer)
│   ├── base/       # CRUDController genérico 
│   ├── auth.ts     # AuthController
│   └── properties.ts # extiende CRUDController
├── services/        # Business logic
│   ├── auth.service.ts
│   └── properties.service.ts  
├── repositories/    # Data access (Drizzle)
│   ├── base/       # BaseRepository genérico
│   └── properties.repository.ts
├── middleware/      # Reusable middleware
│   ├── auth.ts     # JWT validation + roles
│   ├── validation.ts # Zod schemas
│   └── errors.ts   # Error handling
├── utils/          # Helpers
│   ├── file-manager.ts
│   ├── response.ts # apiResponse, apiError
│   └── crypto.ts   # tokens, hashing
└── types/          # TypeScript definitions
```

### **Frontend — Atomic Design**
```
src/
├── routes/         # SvelteKit pages + API routes
├── lib/
│   ├── components/ # Reusable UI components
│   │   ├── atoms/  # Button, Input, Badge
│   │   ├── molecules/ # FormField, DataTable
│   │   └── organisms/ # CRUDForm, FileUpload
│   ├── stores/     # Svelte stores
│   ├── api/        # API client functions  
│   └── utils/      # Frontend helpers
└── app.html        # SvelteKit app shell
```

---

## 🗄️ DATABASE PATTERNS

### **Migrations — Incremental**
```typescript  
// 001_create_users.ts
export const up = async (db: Database) => {
  await db.createTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email', 255).unique().notNull(),
    // ... resto campos
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
    deleted_at: timestamp('deleted_at'), // soft delete
  })
}
```

### **Models — Drizzle Schema**
```typescript
// src/database/schema/users.ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', 255).unique().notNull(),
  role: userRoleEnum('role').notNull().default('client'),
  // ...
})

export type User = InferSelectModel<typeof users>
export type CreateUser = InferInsertModel<typeof users>
```

---

## 🔧 TEMPLATES OBLIGATORIOS

### **Controller Template**
```typescript
// src/controllers/base/crud.controller.ts
import type { Context } from 'hono'

export abstract class CRUDController<T> {
  abstract service: CRUDService<T>
  
  async findAll(c: Context) {
    try {
      const filters = c.req.query()
      const data = await this.service.findAll(filters)
      return c.json(apiResponse(data))
    } catch (error) {
      return c.json(apiError('Failed to fetch items', 500, error), 500)
    }
  }
  
  async findById(c: Context) {
    try {
      const id = Number(c.req.param('id'))
      const data = await this.service.findById(id)
      if (!data) return c.json(apiError('Item not found', 404), 404)
      return c.json(apiResponse(data))
    } catch (error) {
      return c.json(apiError('Failed to fetch item', 500, error), 500)
    }
  }
  
  // create, update, delete methods...
}
```

### **Service Template**
```typescript
// src/services/base/crud.service.ts
export abstract class CRUDService<T> {
  abstract repository: CRUDRepository<T>
  
  async findAll(filters?: Record<string, any>): Promise<T[]> {
    return this.repository.findMany(filters)
  }
  
  async findById(id: number): Promise<T | null> {
    return this.repository.findById(id)
  }
  
  // Validation, business logic aquí
}
```

### **API Route Template**  
```typescript
// src/routes/api/properties/+server.ts (SvelteKit)
import { json } from '@sveltejs/kit'
import { propertiesService } from '$lib/services'

export async function GET({ url }) {
  const filters = Object.fromEntries(url.searchParams)
  const properties = await propertiesService.findAll(filters)
  return json(apiResponse(properties))
}

export async function POST({ request }) {
  const data = await request.json()
  // Validation con Zod
  const property = await propertiesService.create(data)
  return json(apiResponse(property), { status: 201 })
}
```

---

## 🧪 TESTING PATTERNS

### **Unit Tests — Bun Test**
```typescript  
// src/services/properties.service.test.ts
import { describe, test, expect, mock } from 'bun:test'
import { PropertiesService } from './properties.service'

describe('PropertiesService', () => {
  test('findAll returns all properties', async () => {
    const mockRepo = {
      findMany: mock(() => Promise.resolve([{ id: 1, title: 'Test' }]))
    }
    const service = new PropertiesService(mockRepo)
    
    const result = await service.findAll()
    
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Test')
  })
})
```

### **Integration Tests — API**
```typescript
// src/controllers/properties.controller.test.ts  
import { describe, test, expect } from 'bun:test'
import { testApp } from '../test-utils'

describe('Properties API', () => {
  test('GET /api/properties returns 200', async () => {
    const res = await testApp.request('/api/properties')
    
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeArray()
  })
})
```

---

## 📦 CONVENCIONES

### **Naming**
- **Files:** kebab-case (`user-service.ts`, `auth-middleware.ts`)
- **Classes:** PascalCase (`UserService`, `AuthController`)  
- **Functions:** camelCase (`findUser`, `validateToken`)
- **Constants:** UPPER_SNAKE (`DATABASE_URL`, `JWT_SECRET`)

### **Git Commits**
```
feat(properties): add CRUD endpoints
fix(auth): resolve JWT expiration bug  
docs(api): update OpenAPI schema
test(users): add integration tests
refactor(db): migrate to Drizzle ORM
```

### **Error Handling**
```typescript
// Structured errors
export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`)
  }
}

// Controller error handler
catch (error) {
  if (error instanceof ValidationError) {
    return c.json(apiError(error.message, 400, { field: error.field }), 400)
  }
  // Log + generic error
  console.error('Unexpected error:', error)
  return c.json(apiError('Internal server error', 500), 500)
}
```

---

## 🚀 WORKFLOW POR NIVEL

### **Tu proceso de trabajo:**

1. **Recibir task:** "Implementar Nivel X - Feature Y"
2. **Leer contexto:** TECH-SPEC + nivel actual + templates  
3. **Implementar:** siguiendo patterns + templates
4. **Test:** unit + integration si aplica
5. **Document:** actualizar OpenAPI si es API
6. **Commit:** con mensaje estructurado
7. **Validar:** que cumple objectives del nivel
8. **Reportar:** status + next steps

### **Deliverables esperados:**
- **Código** funcional siguiendo patterns
- **Tests** pasando (nivel 2+)
- **Documentación** actualizada
- **Docker** funcionando si aplica
- **Demo** del feature implementado

---

## 🎯 SUCCESS CRITERIA

### **Code Quality**
- [ ] TypeScript strict mode — 0 errores
- [ ] Tests coverage >80% (nivel 2+)  
- [ ] Linting rules pasando
- [ ] Performance benchmarks OK

### **Architecture Compliance**
- [ ] Componentes reutilizables usados
- [ ] No código duplicado
- [ ] Patterns seguidos exactamente
- [ ] ENV vars para config

### **Functionality**  
- [ ] Requirements 100% cumplidos
- [ ] Edge cases manejados
- [ ] Error handling robust  
- [ ] API contracts respetados

---

## 📞 ESCALATION

**Si tienes dudas:**
1. **Consulta primero:** TECH-SPEC.md + COMPONENTS.md
2. **Revisa:** issues similares en el repo
3. **Ask:** en comentarios del task — explica qué consultaste

**Red flags para escalar:**
- Inconsistencias en specs
- Patterns que no funcionan
- Performance issues inesperados
- Breaking changes necesarios

---

**Última actualización:** 2026-02-10  
**Versión:** 1.0  
**Target:** Agentes desarrolladores del sistema inmobiliaria