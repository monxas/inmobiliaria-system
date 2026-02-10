#!/bin/bash
# =============================================================================
# Resource Usage Check Script
# Level 1 Foundation - Performance Monitoring
# =============================================================================

set -e

echo "🔍 Checking Docker resource usage..."
echo ""

# Check if containers are running
if ! docker ps --format '{{.Names}}' | grep -q "inmobiliaria"; then
    echo "❌ No inmobiliaria containers running"
    echo "   Run: docker compose up -d"
    exit 1
fi

echo "📊 Container Memory Usage:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get stats in a nice format
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" \
    inmobiliaria-api inmobiliaria-db inmobiliaria-cache 2>/dev/null || \
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" 2>/dev/null | \
    grep -E "(NAME|inmobiliaria)"

echo ""
echo "📦 Docker Image Sizes:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | \
    grep -E "(REPOSITORY|inmobiliaria|postgres|keydb)"

echo ""

# Calculate total memory (rough estimate from stats)
TOTAL_MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" \
    inmobiliaria-api inmobiliaria-db inmobiliaria-cache 2>/dev/null | \
    awk -F'/' '{gsub(/[^0-9.]/, "", $1); sum += $1} END {print sum}')

echo "📈 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Estimated Total Memory: ~${TOTAL_MEMORY:-unknown}MB"
echo "   Target: <1.2GB (1200MB)"

if [ -n "$TOTAL_MEMORY" ]; then
    if (( $(echo "$TOTAL_MEMORY < 1200" | bc -l) )); then
        echo "   Status: ✅ WITHIN LIMITS"
    else
        echo "   Status: ⚠️  EXCEEDS TARGET"
    fi
fi

echo ""
echo "🏥 Health Checks:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check health endpoints
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$API_HEALTH" = "200" ]; then
    echo "   API: ✅ Healthy"
else
    echo "   API: ❌ Unhealthy (HTTP $API_HEALTH)"
fi

# Check database via docker
DB_HEALTH=$(docker exec inmobiliaria-db pg_isready -U app -d inmobiliaria -q 2>/dev/null && echo "ok" || echo "fail")
if [ "$DB_HEALTH" = "ok" ]; then
    echo "   Database: ✅ Ready"
else
    echo "   Database: ❌ Not ready"
fi

# Check cache
CACHE_HEALTH=$(docker exec inmobiliaria-cache keydb-cli ping 2>/dev/null || echo "fail")
if [ "$CACHE_HEALTH" = "PONG" ]; then
    echo "   Cache: ✅ Ready"
else
    echo "   Cache: ❌ Not ready"
fi

echo ""
