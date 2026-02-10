/**
 * Test Setup — Global test configuration for bun test
 * Sets up environment variables and shared utilities
 */

// Set test environment before anything else
process.env['NODE_ENV'] = 'test'
process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing-only-32chars!'
process.env['FILE_STORAGE_PATH'] = '/tmp/inmobiliaria-test-storage'
process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/inmobiliaria_test'

import { afterAll } from 'bun:test'
import { rm } from 'fs/promises'

// Clean up test storage after all tests
afterAll(async () => {
  try {
    await rm('/tmp/inmobiliaria-test-storage', { recursive: true, force: true })
  } catch {}
})
