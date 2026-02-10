#!/usr/bin/env bun
/**
 * Smoke Test Script — Quick validation that the API is working
 * 
 * Usage:
 *   bun run tests/smoke-test.ts [base-url]
 * 
 * Examples:
 *   bun run tests/smoke-test.ts                    # Default: http://localhost:3000
 *   bun run tests/smoke-test.ts http://api.local   # Custom URL
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000'
const TIMEOUT = 5000

interface TestResult {
  name: string
  success: boolean
  duration: number
  error?: string
  status?: number
}

const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void>) {
  const start = performance.now()
  try {
    await fn()
    results.push({ name, success: true, duration: performance.now() - start })
    console.log(`  ✅ ${name}`)
  } catch (err: any) {
    results.push({ 
      name, 
      success: false, 
      duration: performance.now() - start, 
      error: err.message,
      status: err.status 
    })
    console.log(`  ❌ ${name}: ${err.message}`)
  }
}

async function fetchJSON(path: string, options: RequestInit = {}): Promise<{ status: number; body: any }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT)
  
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    })
    const body = await res.json()
    return { status: res.status, body }
  } finally {
    clearTimeout(timeout)
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function runSmokeTests() {
  console.log(`\n🔥 Smoke Tests — ${BASE_URL}\n`)
  console.log('─'.repeat(50))

  // ── Health Check ──
  await test('Health endpoint responds', async () => {
    const { status, body } = await fetchJSON('/health')
    assert(status === 200 || status === 503, `Expected 2xx/503, got ${status}`)
    assert(body.status === 'healthy' || body.status === 'degraded', 'Invalid health status')
    assert(typeof body.timestamp === 'string', 'Missing timestamp')
  })

  await test('API root returns info', async () => {
    const { status, body } = await fetchJSON('/')
    assert(status === 200, `Expected 200, got ${status}`)
    assert(body.name === 'inmobiliaria-api', 'Unexpected API name')
    assert(typeof body.version === 'string', 'Missing version')
  })

  // ── Auth Flow ──
  const testEmail = `smoke-${Date.now()}@test.com`
  const testPassword = 'smokeTestPass123'
  let authToken = ''

  await test('Register new user', async () => {
    const { status, body } = await fetchJSON('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, password: testPassword, fullName: 'Smoke Test' }),
    })
    // May succeed (201) or fail if endpoint not implemented (404) or user exists (409)
    if (status === 201) {
      assert(body.data?.token, 'Missing token in register response')
      authToken = body.data.token
    } else if (status === 404) {
      console.log('    ⚠️  Auth endpoints not implemented yet')
    } else {
      assert(false, `Unexpected status ${status}: ${JSON.stringify(body)}`)
    }
  })

  await test('Login with credentials', async () => {
    if (!authToken) {
      // Try login anyway in case user exists
      const { status, body } = await fetchJSON('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      })
      if (status === 200) {
        authToken = body.data?.token
      } else if (status === 404) {
        console.log('    ⚠️  Auth endpoints not implemented yet')
        return
      }
    }
    assert(authToken !== '', 'No auth token available')
  })

  await test('Access protected endpoint', async () => {
    if (!authToken) {
      console.log('    ⚠️  Skipped - no auth token')
      return
    }
    const { status, body } = await fetchJSON('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
    if (status === 404) {
      console.log('    ⚠️  Endpoint not implemented')
      return
    }
    assert(status === 200, `Expected 200, got ${status}`)
    assert(body.data?.email === testEmail, 'Email mismatch')
  })

  // ── Properties ──
  await test('List properties (public)', async () => {
    const { status, body } = await fetchJSON('/api/properties')
    if (status === 404) {
      console.log('    ⚠️  Properties endpoint not implemented')
      return
    }
    assert(status === 200, `Expected 200, got ${status}`)
    assert(Array.isArray(body.data), 'Expected array of properties')
  })

  // ── OpenAPI Spec ──
  await test('OpenAPI spec is served', async () => {
    const { status, body } = await fetchJSON('/api/openapi.json')
    assert(status === 200, `Expected 200, got ${status}`)
    assert(body.openapi?.startsWith('3.'), 'Invalid OpenAPI version')
    assert(body.info?.title, 'Missing API title')
  })

  await test('API docs UI is accessible', async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT)
    try {
      const res = await fetch(`${BASE_URL}/docs`, { signal: controller.signal })
      assert(res.status === 200, `Expected 200, got ${res.status}`)
      const html = await res.text()
      assert(html.includes('</html>'), 'Expected HTML response')
    } finally {
      clearTimeout(timeout)
    }
  })

  // ── Error Handling ──
  await test('404 for unknown routes', async () => {
    const { status, body } = await fetchJSON('/api/unknown-endpoint-12345')
    assert(status === 404, `Expected 404, got ${status}`)
    assert(body.error, 'Expected error object')
  })

  await test('Rejects invalid JSON', async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT)
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
        signal: controller.signal,
      })
      assert(res.status === 400 || res.status === 404, `Expected 400/404, got ${res.status}`)
    } finally {
      clearTimeout(timeout)
    }
  })

  // ── Summary ──
  console.log('\n' + '─'.repeat(50))
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0)
  
  console.log(`\n📊 Results: ${passed}/${results.length} passed`)
  console.log(`⏱️  Total time: ${totalTime.toFixed(0)}ms`)
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:')
    for (const r of results.filter(r => !r.success)) {
      console.log(`   - ${r.name}: ${r.error}`)
    }
    process.exit(1)
  } else {
    console.log('\n🎉 All smoke tests passed!\n')
  }
}

// Run
runSmokeTests().catch(err => {
  console.error('\n💥 Smoke test crashed:', err.message)
  process.exit(1)
})
