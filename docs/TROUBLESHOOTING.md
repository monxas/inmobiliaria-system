# 🔧 Troubleshooting Guide

> **Common issues and solutions for Inmobiliaria System**  
> Last Updated: 2026-02-10

---

## 📋 Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Startup Issues](#startup-issues)
3. [Database Issues](#database-issues)
4. [Authentication Issues](#authentication-issues)
5. [API Errors](#api-errors)
6. [Performance Issues](#performance-issues)
7. [Docker Issues](#docker-issues)
8. [Development Issues](#development-issues)

---

## Quick Diagnostics

### Health Check Commands

```bash
# 1. Check all containers are running
docker compose ps

# 2. Basic health check
curl http://localhost:3000/health

# 3. Detailed health (includes database)
curl http://localhost:3000/health/detailed

# 4. Check container logs
docker compose logs --tail=50 backend

# 5. Check database connectivity
docker compose exec database pg_isready -U app -d inmobiliaria
```

### Common Quick Fixes

```bash
# Restart all services
docker compose restart

# Rebuild and restart
docker compose up -d --build

# Nuclear option - reset everything
docker compose down -v && docker compose up -d --build
```

---

## Startup Issues

### Container Won't Start

**Symptom:** `docker compose up` fails or container keeps restarting

**Check:**
```bash
docker compose logs backend
```

**Common Causes:**

1. **Missing environment variables**
   ```bash
   # Check .env file exists and has values
   cat .env | grep -v "^#" | grep -v "^$"
   
   # Required variables:
   # DATABASE_URL, JWT_SECRET
   ```

2. **Port already in use**
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   
   # Kill the process or change PORT in .env
   ```

3. **Database not ready**
   ```bash
   # Wait for database to be healthy
   docker compose logs database
   
   # Check healthcheck status
   docker inspect inmobiliaria-system-database-1 | grep -A 5 Health
   ```

### Database Migration Fails

**Symptom:** `bun run db:migrate` exits with error

**Check:**
```bash
docker compose logs database
```

**Solutions:**

1. **Database not running**
   ```bash
   docker compose up -d database
   sleep 5
   bun run db:migrate
   ```

2. **Wrong DATABASE_URL**
   ```bash
   # Verify URL format
   echo $DATABASE_URL
   # Should be: postgresql://user:pass@host:port/database
   
   # For Docker internal:
   DATABASE_URL=postgresql://app:password@database:5432/inmobiliaria
   
   # For local development:
   DATABASE_URL=postgresql://app:password@localhost:5432/inmobiliaria
   ```

3. **Migration syntax error**
   ```bash
   # Check generated migration files
   ls -la database/migrations/
   
   # View latest migration
   cat database/migrations/*.sql | tail -50
   ```

---

## Database Issues

### Cannot Connect to Database

**Symptom:** "Connection refused" or "ECONNREFUSED"

**Diagnose:**
```bash
# 1. Is database running?
docker compose ps database

# 2. Can we reach it?
docker compose exec database pg_isready -U app

# 3. Check network
docker network ls
docker network inspect inmobiliaria-system_default
```

**Solutions:**

1. **Database not started**
   ```bash
   docker compose up -d database
   ```

2. **Wrong host in DATABASE_URL**
   ```bash
   # Inside Docker: use "database" (service name)
   # Outside Docker: use "localhost" or IP
   ```

3. **Port not exposed**
   ```bash
   # Check docker-compose.yml has:
   # ports:
   #   - "5432:5432"
   ```

### Database Performance

**Symptom:** Slow queries, high latency

**Diagnose:**
```bash
# Check connection count
docker compose exec database psql -U app -d inmobiliaria -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries (if pg_stat_statements enabled)
docker compose exec database psql -U app -d inmobiliaria -c \
  "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

**Solutions:**

1. **Too many connections**
   ```bash
   # Increase pool or add connection pooler (PgBouncer)
   ```

2. **Missing indexes**
   ```sql
   -- Check if indexes are used
   EXPLAIN ANALYZE SELECT * FROM properties WHERE city = 'Madrid';
   ```

3. **Vacuum needed**
   ```bash
   docker compose exec database vacuumdb -U app -d inmobiliaria --analyze
   ```

---

## Authentication Issues

### "Invalid token" Error

**Symptom:** 401 Unauthorized with "Invalid token"

**Diagnose:**
```bash
# Decode token (paste at jwt.io or use jq)
echo "YOUR_TOKEN" | cut -d'.' -f2 | base64 -d | jq
```

**Common Causes:**

1. **Token expired**
   ```bash
   # Check 'exp' claim vs current time
   date +%s  # Current Unix timestamp
   ```

2. **Wrong JWT_SECRET**
   ```bash
   # Ensure same secret in backend and when token was created
   echo $JWT_SECRET
   ```

3. **Malformed Authorization header**
   ```bash
   # Correct format:
   curl -H "Authorization: Bearer eyJhbG..."
   
   # NOT:
   curl -H "Authorization: eyJhbG..."  # Missing "Bearer"
   ```

### "Insufficient permissions"

**Symptom:** 403 Forbidden

**Check:**
```bash
# Decode token and check role
echo "YOUR_TOKEN" | cut -d'.' -f2 | base64 -d | jq '.role'
```

**Solutions:**

1. **Wrong role for endpoint**
   - `/api/users/*` requires `admin` role
   - `/api/properties` POST/PUT/DELETE requires `admin` or `agent`

2. **Update user role**
   ```bash
   docker compose exec database psql -U app -d inmobiliaria -c \
     "UPDATE users SET role = 'admin' WHERE email = 'user@example.com';"
   ```

### Login Fails

**Symptom:** 401 on /api/auth/login

**Check:**
```bash
# Verify user exists
docker compose exec database psql -U app -d inmobiliaria -c \
  "SELECT id, email, role FROM users WHERE email = 'your@email.com';"
```

**Solutions:**

1. **User doesn't exist** — Register first
2. **Wrong password** — Password is hashed, cannot recover; reset it
3. **User soft-deleted** — Check `deleted_at` is NULL

---

## API Errors

### 400 Bad Request

**Symptom:** Validation error

**Response example:**
```json
{
  "success": false,
  "error": {
    "message": "Validation failed: email is required",
    "code": 400,
    "details": { "field": "email" }
  }
}
```

**Solution:** Check request body matches expected schema

### 404 Not Found

**Symptom:** Resource doesn't exist

**Check:**
```bash
# Verify resource exists and isn't deleted
docker compose exec database psql -U app -d inmobiliaria -c \
  "SELECT id, deleted_at FROM properties WHERE id = 123;"
```

### 429 Too Many Requests

**Symptom:** Rate limited

**Response:**
```json
{
  "error": "Too many requests",
  "retryAfter": 60
}
```

**Solutions:**

1. **Wait** for rate limit window to reset (1 minute)
2. **Auth endpoints** have stricter limit (10/min)
3. **Development:** Temporarily increase limits in .env

### 500 Internal Server Error

**Symptom:** Server crash

**Diagnose:**
```bash
# Check backend logs
docker compose logs --tail=100 backend | grep -A5 "error"

# Check for stack traces
docker compose logs backend 2>&1 | grep -A20 "Error:"
```

**Common Causes:**

1. **Database disconnected**
2. **Missing environment variable**
3. **Unhandled exception in code**

---

## Performance Issues

### High Memory Usage

**Diagnose:**
```bash
docker stats --no-stream
```

**Solutions:**

1. **Set memory limits in docker-compose.yml**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
   ```

2. **Reduce PostgreSQL shared_buffers for NAS**

3. **Check for memory leaks in logs**

### Slow Response Times

**Diagnose:**
```bash
# Check response time
time curl http://localhost:3000/api/properties

# Check database latency
curl http://localhost:3000/health/detailed | jq '.database.latencyMs'
```

**Solutions:**

1. **Database needs indexes** — See DATABASE.md
2. **Too many results** — Use pagination (limit parameter)
3. **N+1 queries** — Check for missing joins

### High CPU Usage

**Diagnose:**
```bash
docker stats --no-stream
```

**Solutions:**

1. **Check for infinite loops in logs**
2. **Rate limiter might be doing too much work** — reduce check frequency
3. **Too many concurrent requests** — add connection pooling

---

## Docker Issues

### Disk Space Full

**Symptom:** "no space left on device"

**Diagnose:**
```bash
docker system df
```

**Solutions:**

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

### Network Issues

**Symptom:** Containers can't communicate

**Diagnose:**
```bash
# Check network exists
docker network ls

# Check containers are on same network
docker network inspect inmobiliaria-system_default
```

**Solutions:**

```bash
# Recreate network
docker compose down
docker compose up -d
```

### Volume Mount Issues

**Symptom:** Files not persisting

**Diagnose:**
```bash
docker volume ls
docker volume inspect inmobiliaria-system_db_data
```

**Solutions:**

```bash
# Check volume is mounted
docker compose exec backend ls -la /app/uploads

# Fix permissions
docker compose exec backend chown -R bun:bun /app/uploads
```

---

## Development Issues

### TypeScript Errors

**Symptom:** `tsc` or build fails

**Solutions:**

```bash
# Check for type errors
bunx tsc --noEmit

# Regenerate types from database
bunx drizzle-kit introspect
```

### Tests Failing

**Symptom:** `bun test` exits with failures

**Diagnose:**

```bash
# Run specific test file
bun test backend/tests/unit/specific.test.ts

# Run with verbose output
bun test --verbose
```

**Common Causes:**

1. **Database not running for integration tests**
2. **Environment variables not set**
3. **Stale test database** — reset it

### Hot Reload Not Working

**Symptom:** Changes don't reflect

**Solutions:**

```bash
# Check bun is watching
ps aux | grep bun

# Restart dev server
bun run dev

# Check file is inside watched directory
```

---

## Getting More Help

### Collect Diagnostics

```bash
# Create diagnostic bundle
mkdir diagnostics
docker compose ps > diagnostics/containers.txt
docker compose logs > diagnostics/logs.txt
curl http://localhost:3000/health/detailed > diagnostics/health.json 2>&1
docker stats --no-stream > diagnostics/stats.txt
echo $DATABASE_URL | sed 's/:.*@/:***@/' > diagnostics/env.txt

# Zip it
tar -czf diagnostics.tar.gz diagnostics/
```

### Useful Commands Cheatsheet

```bash
# Restart specific service
docker compose restart backend

# View real-time logs
docker compose logs -f backend

# Shell into container
docker compose exec backend sh

# Database CLI
docker compose exec database psql -U app -d inmobiliaria

# Check container health
docker inspect --format='{{.State.Health.Status}}' container_name

# Tail only errors
docker compose logs backend 2>&1 | grep -i error
```

---

**Still stuck?** Open an issue with your diagnostic bundle attached.
