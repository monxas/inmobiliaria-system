# 🚀 Deployment Guide

> **Production deployment instructions for Inmobiliaria System**  
> Last Updated: 2026-02-10

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Database Setup](#database-setup)
5. [Reverse Proxy Configuration](#reverse-proxy-configuration)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Monitoring](#monitoring)
8. [Backup Strategy](#backup-strategy)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 2GB | 4GB+ |
| Storage | 10GB | 50GB+ |
| CPU | 2 cores | 4 cores |
| OS | Linux (Docker) | Ubuntu 22.04+ / Debian 12+ |

### Software Requirements

- Docker 24.0+
- Docker Compose V2 (comes with Docker)
- Git (for cloning)

### Verify Docker Installation

```bash
docker --version
# Docker version 24.0.0+

docker compose version
# Docker Compose version v2.20.0+
```

---

## Environment Configuration

### 1. Clone Repository

```bash
git clone https://github.com/mon/inmobiliaria-system.git
cd inmobiliaria-system
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `.env` with secure values:

```bash
# Application
NODE_ENV=production
PORT=3000
APP_VERSION=1.0.0

# Database - CHANGE THESE!
DATABASE_URL=postgresql://app:YOUR_SECURE_PASSWORD_HERE@database:5432/inmobiliaria
POSTGRES_USER=app
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
POSTGRES_DB=inmobiliaria

# Authentication - GENERATE SECURE SECRET!
# Generate with: openssl rand -hex 32
JWT_SECRET=your_256_bit_secret_here_minimum_32_characters

# CORS (comma-separated origins)
CORS_ORIGINS=https://inmobiliaria.yourdomain.com

# Rate Limiting
RATE_LIMIT_GENERAL=100
RATE_LIMIT_AUTH=10

# File Uploads
UPLOADS_DIR=/app/uploads
MAX_FILE_SIZE=10485760  # 10MB
```

### Generate Secure Secrets

```bash
# Generate JWT secret (256-bit)
openssl rand -hex 32

# Generate database password
openssl rand -base64 24
```

---

## Docker Deployment

### Quick Start

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Docker Compose Configuration

The `docker-compose.yml` is configured for production:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL
      - JWT_SECRET
      - CORS_ORIGINS
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_started
    volumes:
      - uploads:/app/uploads
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  database:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER
      - POSTGRES_PASSWORD
      - POSTGRES_DB
    volumes:
      - db_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 384M
        reservations:
          memory: 128M
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5

  cache:
    image: eqalpha/keydb:alpine
    restart: unless-stopped
    command: keydb-server --appendonly yes --maxmemory 64mb --maxmemory-policy allkeys-lru
    volumes:
      - cache_data:/data
    deploy:
      resources:
        limits:
          memory: 96M

volumes:
  db_data:
  cache_data:
  uploads:
```

### Run Database Migrations

```bash
# Wait for database to be healthy
docker compose exec backend bun run db:migrate

# Seed initial data (optional)
docker compose exec backend bun run db:seed
```

### Verify Deployment

```bash
# Health check
curl http://localhost:3000/health

# Detailed health (includes DB status)
curl http://localhost:3000/health/detailed

# API info
curl http://localhost:3000/
```

---

## Database Setup

### Initial Migration

Migrations run automatically, but you can also run manually:

```bash
docker compose exec backend bun run db:migrate
```

### Create Admin User

```bash
# Connect to the backend container
docker compose exec backend sh

# Create admin via API or direct database
bun run scripts/create-admin.ts
```

Or via psql:

```bash
docker compose exec database psql -U app -d inmobiliaria

# Create admin (replace password hash)
INSERT INTO users (email, password_hash, role, full_name)
VALUES ('admin@inmobiliaria.local', '$2b$12$...', 'admin', 'Administrator');
```

### Database Backup

```bash
# Create backup
docker compose exec database pg_dump -U app inmobiliaria > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat backup.sql | docker compose exec -T database psql -U app inmobiliaria
```

---

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/inmobiliaria

upstream inmobiliaria_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.inmobiliaria.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.inmobiliaria.yourdomain.com;

    # SSL configuration (see SSL section)
    ssl_certificate /etc/letsencrypt/live/api.inmobiliaria.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.inmobiliaria.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/inmobiliaria_access.log;
    error_log /var/log/nginx/inmobiliaria_error.log;

    # Max upload size
    client_max_body_size 10M;

    location / {
        proxy_pass http://inmobiliaria_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no logging)
    location /health {
        proxy_pass http://inmobiliaria_api;
        access_log off;
    }
}
```

### Enable Site

```bash
ln -s /etc/nginx/sites-available/inmobiliaria /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Caddy Configuration (Alternative)

```caddyfile
# /etc/caddy/Caddyfile

api.inmobiliaria.yourdomain.com {
    reverse_proxy localhost:3000
    
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
    
    log {
        output file /var/log/caddy/inmobiliaria.log
    }
}
```

---

## SSL/TLS Setup

### Using Certbot (Let's Encrypt)

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Generate certificate
certbot --nginx -d api.inmobiliaria.yourdomain.com

# Auto-renewal (check cron)
certbot renew --dry-run
```

### Using Cloudflare (Recommended for NAS)

1. Add domain to Cloudflare
2. Set SSL mode to "Full (strict)"
3. Create Origin Certificate
4. Install on server
5. Update CORS_ORIGINS with Cloudflare domain

---

## Monitoring

### Health Endpoints

```bash
# Basic health (for load balancers)
GET /health
# Returns: {"status": "ok", "timestamp": "..."}

# Detailed health (includes database)
GET /health/detailed
# Returns: {"status": "ok", "version": "1.0.0", "database": {"connected": true, "latencyMs": 2}}
```

### Docker Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### System Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Database connections
docker compose exec database psql -U app -d inmobiliaria -c "SELECT count(*) FROM pg_stat_activity;"
```

### Prometheus Metrics (Optional)

Add to docker-compose.yml for metrics:

```yaml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

---

## Backup Strategy

### Automated Backup Script

Create `/opt/inmobiliaria/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/inmobiliaria/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
docker compose exec -T database pg_dump -U app inmobiliaria | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Uploads backup
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /var/lib/docker/volumes/ inmobiliaria-system_uploads

# Cleanup old backups
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

### Cron Schedule

```bash
# Edit crontab
crontab -e

# Daily backup at 3 AM
0 3 * * * /opt/inmobiliaria/backup.sh >> /var/log/inmobiliaria-backup.log 2>&1
```

### Restore from Backup

```bash
# Stop services
docker compose down

# Restore database
gunzip < backup.sql.gz | docker compose exec -T database psql -U app inmobiliaria

# Restore uploads
tar -xzf uploads_backup.tar.gz -C /var/lib/docker/volumes/inmobiliaria-system_uploads/

# Start services
docker compose up -d
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs backend

# Common issues:
# 1. Database not ready - wait for healthcheck
# 2. Environment variables missing
# 3. Port already in use

# Verify environment
docker compose exec backend env | grep -E "(DATABASE_URL|JWT_SECRET)"
```

### Database Connection Issues

```bash
# Check database is running
docker compose ps database

# Check database logs
docker compose logs database

# Test connection from backend
docker compose exec backend sh -c 'echo "SELECT 1" | psql $DATABASE_URL'
```

### Permission Issues

```bash
# Fix uploads directory permissions
docker compose exec backend chown -R bun:bun /app/uploads

# Fix volume permissions
sudo chown -R 1000:1000 /var/lib/docker/volumes/inmobiliaria-system_uploads/
```

### Performance Issues

```bash
# Check container resources
docker stats

# Check database slow queries
docker compose exec database psql -U app -d inmobiliaria -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Increase resources in docker-compose.yml if needed
```

### Clear and Restart

```bash
# Nuclear option - reset everything
docker compose down -v
docker compose up -d --build
docker compose exec backend bun run db:migrate
docker compose exec backend bun run db:seed
```

---

## Upgrade Procedure

### 1. Backup First

```bash
./backup.sh
```

### 2. Pull Updates

```bash
git pull origin main
```

### 3. Build and Deploy

```bash
docker compose build
docker compose up -d
```

### 4. Run Migrations

```bash
docker compose exec backend bun run db:migrate
```

### 5. Verify

```bash
curl http://localhost:3000/health/detailed
```

### Rollback if Needed

```bash
# Restore from backup
# See Restore from Backup section
```

---

## Security Checklist

- [ ] Strong JWT_SECRET (256-bit minimum)
- [ ] Strong database password
- [ ] HTTPS only (no HTTP)
- [ ] Firewall configured (only 443 exposed)
- [ ] CORS configured correctly
- [ ] Regular backups enabled
- [ ] Log rotation configured
- [ ] Docker socket not exposed
- [ ] Container resources limited
- [ ] Health monitoring enabled

---

**Need help?** Open an issue on GitHub or check the [Troubleshooting](TROUBLESHOOTING.md) guide.
