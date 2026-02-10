#!/bin/bash
# Development: start infra + backend in watch mode
set -e

echo "🚀 Starting development environment..."

# Start only database and cache
docker compose up -d database cache

# Wait for database
echo "⏳ Waiting for database..."
until docker compose exec database pg_isready -U app -d inmobiliaria 2>/dev/null; do
  sleep 1
done

echo "✅ Database ready"

# Run migrations
export DATABASE_URL="postgresql://app:${DB_PASSWORD:-changeme}@localhost:5432/inmobiliaria"
bun run db:migrate

# Start backend in watch mode
echo "🏠 Starting backend..."
bun run dev
