# 🏠 Sistema Inmobiliaria

Sistema de gestión inmobiliaria self-hosted optimizado para NAS.

## Stack
- **Runtime:** Bun + Hono
- **Database:** PostgreSQL 16 Alpine
- **Cache:** KeyDB (Redis-compatible)
- **Frontend:** SvelteKit (Nivel 2+)

## Quick Start

### 1. Setup
```bash
bash scripts/setup.sh
# Review .env file
```

### 2. Development (local Bun + Docker DB)
```bash
bash scripts/dev.sh
```

### 3. Full Docker
```bash
docker compose up -d
```

### 4. Run migrations
```bash
export DATABASE_URL="postgresql://app:PASSWORD@localhost:5432/inmobiliaria"
bun run db:migrate
```

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check (API + DB status) |

## Project Structure
```
├── backend/src/          # Hono API server
│   ├── index.ts          # Entry point
│   ├── database/         # Connection + schema (Drizzle)
│   ├── controllers/      # HTTP handlers
│   ├── services/         # Business logic
│   ├── repositories/     # Data access
│   ├── middleware/        # Auth, errors, logging
│   └── utils/            # Helpers
├── database/
│   ├── migrations/       # SQL migrations
│   └── seeds/            # Seed data
├── docker-compose.yml    # PostgreSQL + KeyDB + Backend
├── Dockerfile            # Multi-stage Bun build
└── docs/                 # Specs & guides
```

## Resource Usage
Target: <1.2GB RAM total
- PostgreSQL: ~384MB limit
- KeyDB: ~96MB limit  
- Backend: ~512MB limit

## Scripts
- `bun run dev` — Watch mode
- `bun run build` — Production build
- `bun run start` — Start built app
- `bun run db:migrate` — Apply migrations
- `bun run db:seed` — Seed database
- `bun run docker:up` — Docker compose up
