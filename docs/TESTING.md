# Testing Strategy Documentation

## Overview

The inmobiliaria-system testing suite follows a comprehensive **testing pyramid** approach:

```
        ╔═══════════════╗
        ║     E2E       ║  ← Full workflow scenarios
        ╠═══════════════╣
        ║   Integration ║  ← API routes + middleware
        ╠═══════════════╣
        ║  Property/Fuzz║  ← Input validation & edge cases
        ╠═══════════════╣
        ║     Unit      ║  ← Isolated function tests
        ╚═══════════════╝
              + 
         Chaos Tests     ← Resilience under failure
         Benchmarks      ← Performance baselines
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)
**Purpose:** Test isolated functions and modules.

```bash
bun test:unit
```

**Coverage targets:**
- Crypto utilities (JWT, hashing, tokens)
- Validation middleware
- Error handling
- Response formatting
- Logger functionality

### 2. Integration Tests (`tests/integration/`)
**Purpose:** Test API routes with mocked dependencies.

```bash
bun test:integration
```

**Coverage targets:**
- Health endpoints
- Auth flows (login, register, refresh)
- CRUD operations for all entities
- Error responses

### 3. Property-Based / Fuzzing Tests (`tests/fuzzing/`)
**Purpose:** Discover edge cases through randomized input testing.

```bash
bun test backend/tests/fuzzing
```

**Invariants tested:**
- Password hashing is one-way and collision-resistant
- JWT signing/verification roundtrips correctly
- Schema validation rejects invalid input
- XSS/SQL injection patterns are rejected

### 4. Chaos Engineering Tests (`tests/chaos/`)
**Purpose:** Verify system resilience under failure conditions.

```bash
bun test backend/tests/chaos
```

**Scenarios tested:**
- Database disconnection
- Timeout handling
- Request floods
- Malformed requests
- Memory pressure
- Error cascade prevention

### 5. Performance Benchmarks (`tests/performance/`)
**Purpose:** Establish and verify performance baselines.

```bash
bun test backend/tests/performance
```

**Metrics captured:**
- Response time percentiles (p50, p95, p99)
- Crypto operation latency
- Concurrent request throughput
- Memory stability under load

### 6. E2E Tests (`tests/e2e/`)
**Purpose:** Full workflow tests with real database.

```bash
# Isolated E2E (no Docker)
bun test backend/tests/e2e

# Full E2E with Docker database
./backend/tests/e2e/run-e2e.sh
```

**Scenarios tested:**
- Complete property listing workflow
- Multi-user concurrent operations
- Access control enforcement
- Full CRUD cycles

## Running Tests

### All Tests
```bash
bun test
```

### With Coverage Report
```bash
bun test --coverage
```

### Watch Mode (Development)
```bash
bun test:watch
```

### Specific Test File
```bash
bun test backend/tests/unit/utils/crypto.test.ts
```

## Test Configuration

### Parallel Execution
Tests run in parallel by default. Control parallelism via:

```toml
# backend/bunfig.toml
[test]
timeout = 30000
```

### Environment Variables
```bash
# Test environment
NODE_ENV=test
LOG_LEVEL=warn        # Reduce log noise
JWT_SECRET=test-key   # Consistent test tokens
```

## Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Line Coverage | 95% | 95%+ |
| Function Coverage | 90% | 90%+ |
| Branch Coverage | 85% | 85%+ |

### Viewing Coverage Report
```bash
bun test --coverage
# Report saved to: backend/coverage/
```

## Test Data Management

### Factories (`tests/factories.ts`)
Generate consistent test data:

```typescript
import { buildUser, buildProperty, buildClient } from '../factories'

const user = buildUser({ role: 'admin' })
const property = buildProperty({ city: 'Madrid' })
```

### Helpers (`tests/helpers.ts`)
Common testing utilities:

```typescript
import { appRequest, parseResponse, generateTestToken, measureTime } from '../helpers'

const token = generateTestToken({ userId: 1, role: 'agent' })
const res = await appRequest(app, 'POST', '/api/properties', { token, body: {...} })
const data = await parseResponse(res)
```

### Custom Matchers (`tests/matchers.ts`)
Domain-specific assertions:

```typescript
import { expectValidProperty, expectSuccessResponse, expectFasterThan } from '../matchers'

const data = expectSuccessResponse(body)
expectValidProperty(data)
await expectFasterThan(50, () => fetch('/api/properties'))
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
```

### Pre-commit Hook
```bash
# .husky/pre-commit
bun test:unit
```

### Pre-push Hook
```bash
# .husky/pre-push
bun test
```

## Performance Baselines

Established benchmarks (p99 latency):

| Operation | Target | Notes |
|-----------|--------|-------|
| Simple JSON response | < 2ms | |
| 100-item response | < 10ms | |
| 1000-item response | < 50ms | |
| JWT sign | < 0.5ms | |
| JWT verify | < 0.5ms | |
| Password hash | < 400ms | bcrypt cost factor |
| 100 concurrent reqs | < 100ms total | |
| 1000 concurrent reqs | < 1000ms total | |

## Best Practices

### Writing Tests

1. **Arrange-Act-Assert** pattern
2. **One assertion focus** per test
3. **Descriptive test names** (`should X when Y`)
4. **Independent tests** (no shared state)
5. **Fast tests** (mock slow dependencies)

### Test Isolation

```typescript
beforeEach(() => {
  resetFactoryCounter()
  mockDb.reset()
})

afterEach(() => {
  cleanup()
})
```

### Async Testing

```typescript
test('async operation', async () => {
  const result = await asyncFunction()
  expect(result).toBe(expected)
})
```

### Error Testing

```typescript
test('throws on invalid input', () => {
  expect(() => riskyFunction(badInput)).toThrow(ExpectedError)
})

test('async throws', async () => {
  await expect(asyncRiskyFunction()).rejects.toThrow()
})
```

## Troubleshooting

### Tests Timing Out
```bash
bun test --timeout 60000
```

### Flaky Tests
- Check for shared state
- Add explicit waits for async operations
- Use deterministic mocks

### Coverage Not Updating
```bash
rm -rf backend/coverage
bun test --coverage
```

## Adding New Tests

1. Create test file in appropriate directory
2. Import from `../setup` for test configuration
3. Use factories and helpers for consistency
4. Add to appropriate test script in `package.json` if needed
5. Verify coverage didn't decrease

---

*Last updated: 2026-02-10*
