# 💻 Development Guide

> **Local development setup and contribution guidelines for Inmobiliaria System**  
> Last Updated: 2026-02-10

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Development Workflow](#development-workflow)
4. [Code Style](#code-style)
5. [Testing](#testing)
6. [Git Workflow](#git-workflow)
7. [Code Review Guidelines](#code-review-guidelines)
8. [Common Tasks](#common-tasks)

---

## Prerequisites

### Required Software

| Tool | Version | Installation |
|------|---------|--------------|
| Bun | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| Docker | 24.0+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Git | 2.40+ | `apt install git` |
| VS Code | Latest | [code.visualstudio.com](https://code.visualstudio.com/) |

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "mikestead.dotenv",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

---

## Local Setup

### 1. Clone Repository

```bash
git clone https://github.com/mon/inmobiliaria-system.git
cd inmobiliaria-system
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Start Database (Docker)

```bash
# Start PostgreSQL and KeyDB
docker compose up -d database cache
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` for local development:
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://app:devpass123@localhost:5432/inmobiliaria
JWT_SECRET=development_secret_minimum_32_characters_long
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 5. Run Migrations

```bash
# Set DATABASE_URL in shell
export DATABASE_URL="postgresql://app:devpass123@localhost:5432/inmobiliaria"

# Run migrations
bun run db:migrate

# Seed with test data
bun run db:seed
```

### 6. Start Development Server

```bash
bun run dev
```

The API is now running at `http://localhost:3000`

### 7. Verify Setup

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/

# Test auth
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"devpass123","fullName":"Developer"}'
```

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Start database
docker compose up -d database cache

# 3. Check for new migrations
bun run db:migrate

# 4. Start dev server
bun run dev

# 5. Work on your feature
# ... code changes ...

# 6. Run tests
bun test

# 7. Commit with conventional commits
git commit -m "feat: add property images endpoint"

# 8. Push and create PR
git push origin feature/my-feature
```

### Hot Reload

The dev server (`bun run dev`) watches for file changes and restarts automatically.

### Drizzle Studio

Explore the database visually:

```bash
bun run db:studio
# Opens at https://local.drizzle.studio
```

---

## Code Style

### TypeScript

- **Strict mode** enabled (`strict: true` in tsconfig.json)
- **No `any`** — use `unknown` and narrow types
- **Prefer `const`** over `let`
- **Use interfaces** for object shapes, `type` for unions/intersections

### File Naming

```
src/
├── controllers/
│   └── properties.controller.ts    # kebab-case, suffixed
├── services/
│   └── properties.service.ts
├── repositories/
│   └── properties.repository.ts
├── routes/
│   └── properties.ts               # no suffix for route files
├── database/
│   └── schema/
│       └── properties.ts           # no suffix for schema
└── types/
    └── index.ts                    # barrel exports
```

### Import Order

```typescript
// 1. External modules
import { Hono } from 'hono'
import { z } from 'zod'

// 2. Internal modules (absolute paths)
import { apiResponse } from '../utils/response'
import { logger } from '../lib/logger'

// 3. Types
import type { Context } from 'hono'
import type { User } from '../types'
```

### JSDoc for Public APIs

```typescript
/**
 * Creates a new property listing.
 * 
 * @param input - Validated property creation input
 * @returns The created property with generated ID
 * @throws {ValidationError} If input validation fails
 * @throws {DatabaseError} If database operation fails
 * 
 * @example
 * ```typescript
 * const property = await propertiesService.create({
 *   title: 'Beautiful Apartment',
 *   address: 'Gran Via 50',
 *   city: 'Madrid',
 *   propertyType: 'apartment',
 *   price: 250000
 * })
 * ```
 */
async create(input: CreatePropertyInput): Promise<Property> {
  // ...
}
```

---

## Testing

### Test Structure

```
backend/tests/
├── unit/                    # Unit tests
│   ├── services/
│   └── utils/
├── integration/             # Integration tests
│   └── api/
├── security/                # Security tests
├── performance/             # Performance benchmarks
└── smoke-test.ts            # Post-deployment verification
```

### Running Tests

```bash
# All tests
bun test

# Specific suite
bun run test:unit
bun run test:integration
bun run test:security
bun run test:performance

# Watch mode
bun run test:watch

# With coverage
bun test --coverage
```

### Writing Tests

```typescript
// backend/tests/unit/services/properties.service.test.ts
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { PropertiesService } from '../../../src/services/properties.service'

describe('PropertiesService', () => {
  let service: PropertiesService
  
  beforeEach(() => {
    service = new PropertiesService()
  })
  
  describe('create', () => {
    it('should create a property with default status', async () => {
      const input = {
        title: 'Test Property',
        address: 'Test Address',
        city: 'Madrid',
        propertyType: 'apartment' as const,
        price: 100000,
      }
      
      const result = await service.create(input)
      
      expect(result.status).toBe('available')
      expect(result.title).toBe('Test Property')
    })
    
    it('should throw ValidationError for negative price', async () => {
      const input = { /* ... */ price: -100 }
      
      await expect(service.create(input)).rejects.toThrow('price must be positive')
    })
  })
})
```

### Test Coverage Goals

| Area | Target | Current |
|------|--------|---------|
| Unit | 90% | 89% |
| Integration | 80% | 85% |
| Overall | 85% | 89% |

---

## Git Workflow

### Branching Strategy

```
main
  └── develop
        ├── feature/property-images
        ├── feature/email-notifications
        ├── fix/rate-limiter-bug
        └── chore/update-dependencies
```

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/property-images` |
| Bug Fix | `fix/description` | `fix/auth-token-expiry` |
| Hotfix | `hotfix/description` | `hotfix/security-patch` |
| Chore | `chore/description` | `chore/update-deps` |
| Docs | `docs/description` | `docs/api-examples` |

### Conventional Commits

```bash
# Format: <type>(<scope>): <description>

# Features
git commit -m "feat(properties): add image upload endpoint"
git commit -m "feat(auth): implement refresh token rotation"

# Bug fixes
git commit -m "fix(rate-limiter): handle edge case for burst requests"

# Documentation
git commit -m "docs(api): add curl examples for all endpoints"

# Chores
git commit -m "chore(deps): update drizzle-orm to v0.30"

# Breaking changes
git commit -m "feat(api)!: change response format for pagination"
```

### Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc. |
| `refactor` | Code change that neither fixes nor adds |
| `perf` | Performance improvement |
| `test` | Adding missing tests |
| `chore` | Maintenance tasks |
| `ci` | CI configuration changes |

---

## Code Review Guidelines

### For Authors

1. **Keep PRs small** — aim for <400 lines changed
2. **Self-review first** — check your own diff before requesting review
3. **Write descriptive PR title** — use conventional commit format
4. **Include context** — explain WHY, not just WHAT
5. **Add tests** — no new code without tests
6. **Update docs** — if behavior changes, update docs

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No hardcoded values
```

### For Reviewers

1. **Be constructive** — suggest improvements, don't just criticize
2. **Ask questions** — if something is unclear, ask
3. **Check for**:
   - Security issues (SQL injection, XSS, etc.)
   - Performance concerns
   - Error handling
   - Test coverage
   - Documentation
4. **Approve with comments** — minor issues don't need to block

### Review Labels

| Label | Meaning |
|-------|---------|
| `needs-review` | Ready for review |
| `changes-requested` | Needs modifications |
| `approved` | Ready to merge |
| `wip` | Work in progress |

---

## Common Tasks

### Add New Endpoint

1. **Schema** — Define Zod validation schema
2. **Repository** — Add data access methods if needed
3. **Service** — Add business logic
4. **Controller** — Add HTTP handler
5. **Route** — Register endpoint
6. **Test** — Write unit and integration tests
7. **Docs** — Update API documentation

### Add New Database Table

```bash
# 1. Define schema in src/database/schema/
# 2. Generate migration
bunx drizzle-kit generate

# 3. Review migration in database/migrations/
# 4. Apply migration
bun run db:migrate

# 5. Update types if needed
```

### Debug a Request

```typescript
// Add to any handler
console.log(JSON.stringify({
  method: c.req.method,
  url: c.req.url,
  headers: Object.fromEntries(c.req.raw.headers),
  query: c.req.query(),
  body: await c.req.json(),
}, null, 2))
```

### Reset Database

```bash
# Drop and recreate
docker compose down database
docker compose up -d database

# Wait for startup
sleep 5

# Run migrations
bun run db:migrate

# Seed data
bun run db:seed
```

### Update Dependencies

```bash
# Check outdated
bun outdated

# Update all
bun update

# Update specific package
bun add package@latest
```

---

## IDE Configuration

### VS Code Settings

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "node_modules": true,
    "dist": true
  }
}
```

### Debugging

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Backend",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

---

## Getting Help

- **Documentation** — Check the `docs/` directory
- **ADRs** — Understand decisions in `docs/adr/`
- **Issues** — Search existing issues first
- **Discussions** — Use GitHub Discussions for questions

---

**Happy coding! 🚀**
