#!/usr/bin/env bun
/**
 * @fileoverview Performance benchmark script
 * Level 1 Foundation - Performance Baselines
 * 
 * Run: bun scripts/benchmark.ts
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000'
const ITERATIONS = 100

interface BenchmarkResult {
  name: string
  iterations: number
  avgMs: number
  minMs: number
  maxMs: number
  p95Ms: number
  p99Ms: number
  rps: number
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = ITERATIONS
): Promise<BenchmarkResult> {
  const times: number[] = []
  
  // Warmup (10% of iterations)
  const warmup = Math.max(1, Math.floor(iterations * 0.1))
  for (let i = 0; i < warmup; i++) {
    await fn()
  }
  
  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  
  // Calculate statistics
  times.sort((a, b) => a - b)
  const sum = times.reduce((a, b) => a + b, 0)
  const avg = sum / times.length
  
  return {
    name,
    iterations,
    avgMs: Math.round(avg * 100) / 100,
    minMs: Math.round(times[0] * 100) / 100,
    maxMs: Math.round(times[times.length - 1] * 100) / 100,
    p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 100) / 100,
    p99Ms: Math.round(times[Math.floor(times.length * 0.99)] * 100) / 100,
    rps: Math.round(1000 / avg),
  }
}

async function fetchJSON(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
}

// =============================================================================
// Benchmark Tests
// =============================================================================

async function runBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  
  console.log(`\n🚀 Running benchmarks against ${BASE_URL}\n`)
  console.log(`   Iterations per test: ${ITERATIONS}`)
  console.log(`   Warmup: ${Math.floor(ITERATIONS * 0.1)} iterations\n`)
  
  // Health check
  console.log('📊 Benchmarking: Health Check (GET /health)')
  results.push(await benchmark('GET /health', async () => {
    const res = await fetchJSON('/health')
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  }))
  
  // Health detailed
  console.log('📊 Benchmarking: Health Detailed (GET /health/detailed)')
  results.push(await benchmark('GET /health/detailed', async () => {
    const res = await fetchJSON('/health/detailed')
    if (!res.ok) throw new Error(`Health detailed failed: ${res.status}`)
  }))
  
  // Root endpoint
  console.log('📊 Benchmarking: Root (GET /)')
  results.push(await benchmark('GET /', async () => {
    const res = await fetchJSON('/')
    if (!res.ok) throw new Error(`Root failed: ${res.status}`)
  }))
  
  // Properties list (unauthenticated - might 401)
  console.log('📊 Benchmarking: Properties List (GET /api/properties)')
  results.push(await benchmark('GET /api/properties', async () => {
    await fetchJSON('/api/properties')
    // Don't check status - might require auth
  }))
  
  return results
}

// =============================================================================
// Output
// =============================================================================

function printResults(results: BenchmarkResult[]) {
  console.log('\n' + '='.repeat(80))
  console.log('📈 BENCHMARK RESULTS')
  console.log('='.repeat(80) + '\n')
  
  console.log(
    '| Endpoint'.padEnd(30) +
    '| Avg (ms)'.padEnd(12) +
    '| Min'.padEnd(10) +
    '| Max'.padEnd(10) +
    '| P95'.padEnd(10) +
    '| P99'.padEnd(10) +
    '| RPS'.padEnd(8) + '|'
  )
  console.log('|' + '-'.repeat(29) + '|' + '-'.repeat(11) + '|' + '-'.repeat(9) + '|' + '-'.repeat(9) + '|' + '-'.repeat(9) + '|' + '-'.repeat(9) + '|' + '-'.repeat(7) + '|')
  
  for (const r of results) {
    console.log(
      `| ${r.name.padEnd(28)}` +
      `| ${r.avgMs.toString().padEnd(10)}` +
      `| ${r.minMs.toString().padEnd(8)}` +
      `| ${r.maxMs.toString().padEnd(8)}` +
      `| ${r.p95Ms.toString().padEnd(8)}` +
      `| ${r.p99Ms.toString().padEnd(8)}` +
      `| ${r.rps.toString().padEnd(6)}|`
    )
  }
  
  console.log('\n' + '='.repeat(80))
  
  // Summary
  const avgRps = results.reduce((a, r) => a + r.rps, 0) / results.length
  const avgLatency = results.reduce((a, r) => a + r.avgMs, 0) / results.length
  
  console.log('\n📊 SUMMARY')
  console.log(`   Average RPS: ${Math.round(avgRps)}`)
  console.log(`   Average Latency: ${Math.round(avgLatency * 100) / 100}ms`)
  console.log(`   Tests: ${results.length}`)
  console.log(`   Total Requests: ${results.length * ITERATIONS}`)
  
  // Save to JSON
  const output = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    iterations: ITERATIONS,
    results,
    summary: {
      avgRps: Math.round(avgRps),
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
    }
  }
  
  Bun.write('benchmark-results.json', JSON.stringify(output, null, 2))
  console.log('\n✅ Results saved to benchmark-results.json\n')
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  try {
    // Check if server is running
    const health = await fetch(`${BASE_URL}/health`).catch(() => null)
    if (!health?.ok) {
      console.error(`❌ Server not responding at ${BASE_URL}`)
      console.error('   Make sure the server is running: bun run dev')
      process.exit(1)
    }
    
    const results = await runBenchmarks()
    printResults(results)
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
    process.exit(1)
  }
}

main()
