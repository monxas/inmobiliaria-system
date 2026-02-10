#!/bin/bash
#
# E2E Test Runner
# Spins up docker-compose test environment and runs tests
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.test.yml"
PROJECT_NAME="inmobiliaria-e2e"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[E2E]${NC} $1"; }
warn() { echo -e "${YELLOW}[E2E]${NC} $1"; }
error() { echo -e "${RED}[E2E]${NC} $1"; }

cleanup() {
  log "Cleaning up test environment..."
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans 2>/dev/null || true
}

# Trap cleanup on exit
trap cleanup EXIT

log "Starting E2E test environment..."
cleanup

# Build and start services
log "Building containers..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --quiet

log "Starting services..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d

# Wait for API to be healthy
log "Waiting for API to be healthy..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    log "API is healthy!"
    break
  fi
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    error "API failed to start after $max_attempts attempts"
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs
    exit 1
  fi
  sleep 1
done

# Run tests
log "Running E2E tests..."
cd "$SCRIPT_DIR/../.."

# Set test environment variables
export API_URL="http://localhost:3001"
export DATABASE_URL="postgresql://test:testpassword@localhost:5433/inmobiliaria_test"
export JWT_SECRET="test-secret-key-for-e2e-testing"

# Run only E2E tests
bun test backend/tests/e2e --timeout 60000

TEST_EXIT=$?

if [ $TEST_EXIT -eq 0 ]; then
  log "All E2E tests passed! ✓"
else
  error "E2E tests failed"
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs test-api
fi

exit $TEST_EXIT
