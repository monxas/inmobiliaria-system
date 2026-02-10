# 📋 TECH-SPEC v2 — Sistema Inmobiliaria

> **Status:** Especificación actualizada post-auditoría  
> **Basado en:** Análisis crítico + recomendaciones ejecutivas  
> **Stack final:** PostgreSQL + Bun + Hono + SvelteKit

---

## 🏗️ ARQUITECTURA

### **Patrón:** 3-layer + Components
- **Frontend:** SvelteKit único con roles (admin/user)  
- **API:** Bun + Hono + middleware genérico
- **Database:** PostgreSQL 16 Alpine
- **Cache:** KeyDB (Redis-compatible)
- **Files:** Local storage + token URLs

### **Principios de Diseño**
1. **API-first** — Frontend consume API documented
2. **Componentes reutilizables** — CRUD base, Auth, FileManager  
3. **Type-safe** — Drizzle ORM + TypeScript strict
4. **Docker-native** — Todo containerizado
5. **NAS-optimized** — <1.2GB RAM total
6. **LLM-ready** — API determinista + webhooks

---

## 🗄️ DATABASE SCHEMA

### **Usuarios y Auth**
```sql
users: 
  id, email, password_hash, role, full_name, 
  created_at, updated_at, deleted_at

user_roles: admin, agent, client

user_sessions:
  id, user_id, token_hash, expires_at, ip_address
```

### **Inmobiliaria Core**
```sql
properties:
  id, title, description, address, property_type, 
  price, status, owner_id, agent_id,
  created_at, updated_at, deleted_at

property_images: -- 🆕 CRÍTICO DETECTADO POR AGENTE
  id, property_id, filename, file_path, order, 
  is_primary, alt_text, created_at

clients:
  id, full_name, email, phone, notes,
  created_at, updated_at, deleted_at

client_properties: -- many-to-many 🆕
  id, client_id, property_id, relationship_type,
  created_at
```

### **Documentos y Files**
```sql
documents:
  id, property_id, filename, file_path, mime_type,
  access_token, expires_at, download_count,
  created_at

file_access_logs:
  id, document_id, ip_address, user_agent, accessed_at
```

---

## 🚀 STACK TÉCNICO

### **Runtime**
- **Primary:** Bun 1.0+ (ultra-fast, TypeScript native)
- **Fallback:** Node.js 22 + Fastify (si Bun falla en ARM)

### **API Framework**
- **Hono** — Ultralight, edge-ready, middleware rich
- **Drizzle ORM** — Type-safe, migrations, PostgreSQL optimized

### **Database**  
- **PostgreSQL 16 Alpine** — 150MB container
- **Configuración:** 128MB shared_buffers (NAS 4GB) / 256MB (NAS 8GB+)

### **Frontend**
- **SvelteKit** — 1 aplicación, roles por routes
- **Tailwind CSS** — Componentes genéricos
- **Lucide icons** — Consistente con otros proyectos

### **Testing**
- **Bun built-in test runner** — No Vitest para simplificar

---

## 🔧 COMPONENTES REUTILIZABLES

### **Backend Components**
```typescript
// Generic CRUD controller base
abstract class CRUDController<T> {
  abstract table: DrizzleTable
  async findAll(filters?: Filters): Promise<T[]>
  async findById(id: number): Promise<T | null>  
  async create(data: CreateT): Promise<T>
  async update(id: number, data: UpdateT): Promise<T>
  async delete(id: number): Promise<void>
}

// Auth middleware
const requireRole = (roles: UserRole[]) => async (c: Context, next) => {}
const requireAuth = () => async (c: Context, next) => {}

// File manager
class FileManager {
  async upload(file: File, category: string): Promise<FileRecord>
  generateSecureToken(fileId: number, expiresIn: string): string
  async getByToken(token: string): Promise<FileRecord | null>
}

// Response formatters  
const apiResponse = <T>(data: T, meta?: ResponseMeta) => ({ data, meta })
const apiError = (message: string, code: number, details?: any) => ({})
```

### **Frontend Components**
```typescript
// Generic CRUD views
<CRUDTable items={data} columns={columns} actions={actions} />
<CRUDForm schema={zodSchema} onSubmit={handler} />
<FileUpload multiple={true} accept="image/*,application/pdf" />
<UserRoleGuard requiredRole="admin">...</UserRoleGuard>
```

---

## 🐳 DOCKER SETUP

### **docker-compose.yml**
```yaml
version: '3.8'

services:
  database:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: inmobiliaria
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  cache:
    image: eqalpha/keydb:alpine  # 70MB vs Redis 100MB
    restart: unless-stopped
    command: keydb-server --appendonly yes
    
  backend:
    build: ./backend
    restart: unless-stopped  # 🆕 CRÍTICO DETECTADO
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://app:${DB_PASSWORD}@database:5432/inmobiliaria
      REDIS_URL: redis://cache:6379
    depends_on:
      - database
      - cache
    healthcheck:  # 🆕
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  db_data:
```

### **Dockerfile**
```dockerfile
# Multi-stage: Bun primary, Node fallback
FROM oven/bun:1-alpine as bun-build
WORKDIR /app
COPY package*.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --outdir dist
EXPOSE 3000
CMD ["bun", "start"]

# Fallback para ARM/problemas con Bun
FROM node:22-alpine as node-fallback  
# ... setup similar para Node
```

---

## 🔐 SEGURIDAD

### **Authentication**
- **JWT tokens** — 7 días expire, refresh pattern
- **Password hashing** — bcrypt + salt
- **Rate limiting** — 100 req/min por IP

### **Authorization**  
- **Role-based** — admin, agent, client
- **Resource-based** — usuarios solo ven sus propiedades
- **Token-based file access** — URLs expiran en 24h

### **File Security**
- **Validated uploads** — MIME type + file signature
- **Secure paths** — no direct file access
- **Size limits** — 10MB docs, 5MB images
- **Virus scanning** — post-MVP

---

## 🎯 OBJETIVOS POR NIVEL

### **Nivel 0 — Docs (CURRENT)**
- ✅ Tech-spec actualizada
- [ ] Components design
- [ ] Database migrations
- [ ] API design + OpenAPI
- [ ] Agents development guide

### **Nivel 1 — Foundation**  
- [ ] Docker compose + PostgreSQL running
- [ ] Bun + Hono básico + health endpoint
- [ ] Migraciones database aplicadas
- [ ] CI/CD pipeline básico

### **Nivel 2 — Core API**
- [ ] Auth JWT + roles implementado
- [ ] Generic CRUD controllers
- [ ] Users + Properties + Clients endpoints
- [ ] API tests + OpenAPI docs

---

## 🤖 PREPARACIÓN PARA AGENTES

### **Context Files para Agentes**
- Cada agente recibe: `TECH-SPEC.md` + `COMPONENTS.md` + nivel actual
- Templates de código disponibles en `/templates`
- Convenciones de naming y estructura definidas
- Tests examples para seguir patrones

### **Development Commands**
```bash
bun run dev          # Development server
bun run build        # Production build  
bun run test         # Run tests
bun run db:migrate   # Apply migrations
bun run db:seed      # Seed database
```

---

**Versión:** 2.0 (post-auditoría)  
**Actualizado:** 2026-02-10  
**Inconsistencias resueltas:** SQLite→PostgreSQL, 2-frontends→1, Node→Bun, restart policies**