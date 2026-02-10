import { Hono } from 'hono'
import { testConnection } from '../database/connection'
import { statfsSync } from 'fs'

const health = new Hono()

const startTime = Date.now()

interface CheckResult {
  status: 'ok' | 'error'
  responseMs?: number
  message?: string
  [key: string]: unknown
}

async function checkDatabase(): Promise<CheckResult> {
  const start = performance.now()
  try {
    await testConnection()
    return { status: 'ok', responseMs: Math.round(performance.now() - start) }
  } catch (e: any) {
    return { status: 'error', responseMs: Math.round(performance.now() - start), message: e.message }
  }
}

function checkDiskSpace(path = '/'): CheckResult {
  try {
    const stats = statfsSync(path)
    const totalBytes = stats.blocks * stats.bsize
    const freeBytes = stats.bfree * stats.bsize
    const usedPercent = Math.round(((totalBytes - freeBytes) / totalBytes) * 100)
    return {
      status: usedPercent > 95 ? 'error' : 'ok',
      usedPercent,
      freeGb: Math.round(freeBytes / 1073741824 * 10) / 10,
    }
  } catch {
    return { status: 'error', message: 'Unable to check disk space' }
  }
}

function checkMemory(): CheckResult {
  const used = process.memoryUsage()
  const heapUsedMb = Math.round(used.heapUsed / 1048576)
  const heapTotalMb = Math.round(used.heapTotal / 1048576)
  const rssMb = Math.round(used.rss / 1048576)
  return {
    status: 'ok',
    heapUsedMb,
    heapTotalMb,
    rssMb,
  }
}

/** Basic liveness — always returns 200 if process is running */
health.get('/', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

/** Kubernetes readiness probe — checks critical dependencies */
health.get('/ready', async (c) => {
  const db = await checkDatabase()
  const ready = db.status === 'ok'
  return c.json({
    status: ready ? 'ready' : 'not_ready',
    checks: { database: db },
  }, ready ? 200 : 503)
})

/** Detailed health with all checks */
health.get('/detailed', async (c) => {
  const [db] = await Promise.all([checkDatabase()])
  const disk = checkDiskSpace()
  const memory = checkMemory()

  const checks = { database: db, disk, memory }
  const allOk = Object.values(checks).every((ch) => ch.status === 'ok')

  return c.json({
    status: allOk ? 'healthy' : 'degraded',
    version: process.env.APP_VERSION || '0.1.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  }, allOk ? 200 : 503)
})

export { health }
