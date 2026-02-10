/**
 * Comprehensive Audit Trail System
 * 
 * Implements:
 * - Full CRUD operation logging
 * - Before/after data capture
 * - User attribution
 * - IP and user agent tracking
 * - Tamper-evident logging
 * - Retention policies
 */

import { createHash } from 'crypto'
import { logger } from '../logger'

const log = logger.child({ module: 'audit-trail' })

// Audit event types
export enum AuditAction {
  // Auth events
  LOGIN = 'auth.login',
  LOGIN_FAILED = 'auth.login_failed',
  LOGOUT = 'auth.logout',
  LOGOUT_ALL = 'auth.logout_all',
  PASSWORD_CHANGE = 'auth.password_change',
  PASSWORD_RESET = 'auth.password_reset',
  MFA_ENABLED = 'auth.mfa_enabled',
  MFA_DISABLED = 'auth.mfa_disabled',
  
  // CRUD events
  CREATE = 'data.create',
  READ = 'data.read',
  READ_LIST = 'data.read_list',
  UPDATE = 'data.update',
  DELETE = 'data.delete',
  SOFT_DELETE = 'data.soft_delete',
  RESTORE = 'data.restore',
  
  // Admin events
  USER_CREATE = 'admin.user_create',
  USER_UPDATE = 'admin.user_update',
  USER_DELETE = 'admin.user_delete',
  ROLE_CHANGE = 'admin.role_change',
  PERMISSION_GRANT = 'admin.permission_grant',
  PERMISSION_REVOKE = 'admin.permission_revoke',
  ACCOUNT_UNLOCK = 'admin.account_unlock',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'security.rate_limit',
  ACCOUNT_LOCKED = 'security.account_locked',
  SUSPICIOUS_ACTIVITY = 'security.suspicious',
  TOKEN_REVOKED = 'security.token_revoked',
  
  // Data events
  EXPORT = 'data.export',
  IMPORT = 'data.import',
  BULK_UPDATE = 'data.bulk_update',
  BULK_DELETE = 'data.bulk_delete',
}

export enum AuditSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  CRITICAL = 'critical',
}

export interface AuditContext {
  userId?: number
  userEmail?: string
  userRole?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
  sessionId?: string
}

export interface AuditData {
  entityType: string          // e.g., 'property', 'client', 'user'
  entityId?: string | number
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  changes?: Record<string, { old: unknown; new: unknown }>
  metadata?: Record<string, unknown>
}

export interface AuditEntry {
  id: string
  timestamp: string
  action: AuditAction
  severity: AuditSeverity
  context: AuditContext
  data: AuditData
  hash: string              // For tamper detection
  previousHash?: string     // Chain to previous entry
}

// In-memory store with retention (use database in production)
class AuditStore {
  private entries: AuditEntry[] = []
  private lastHash: string = 'genesis'
  private maxEntries: number = 100000
  private retentionDays: number = 90
  
  add(entry: Omit<AuditEntry, 'id' | 'hash' | 'previousHash'>): AuditEntry {
    const id = this.generateId()
    const previousHash = this.lastHash
    
    // Create hash chain for tamper detection
    const hash = this.createHash({ ...entry, id, previousHash })
    
    const fullEntry: AuditEntry = {
      ...entry,
      id,
      hash,
      previousHash,
    }
    
    this.lastHash = hash
    this.entries.push(fullEntry)
    
    // Enforce retention
    this.enforceRetention()
    
    return fullEntry
  }
  
  query(filter: {
    action?: AuditAction
    entityType?: string
    entityId?: string | number
    userId?: number
    fromDate?: Date
    toDate?: Date
    severity?: AuditSeverity
    limit?: number
    offset?: number
  }): { entries: AuditEntry[]; total: number } {
    let results = [...this.entries]
    
    if (filter.action) {
      results = results.filter(e => e.action === filter.action)
    }
    if (filter.entityType) {
      results = results.filter(e => e.data.entityType === filter.entityType)
    }
    if (filter.entityId) {
      results = results.filter(e => e.data.entityId === filter.entityId)
    }
    if (filter.userId) {
      results = results.filter(e => e.context.userId === filter.userId)
    }
    if (filter.severity) {
      results = results.filter(e => e.severity === filter.severity)
    }
    if (filter.fromDate) {
      const from = filter.fromDate.getTime()
      results = results.filter(e => new Date(e.timestamp).getTime() >= from)
    }
    if (filter.toDate) {
      const to = filter.toDate.getTime()
      results = results.filter(e => new Date(e.timestamp).getTime() <= to)
    }
    
    const total = results.length
    
    // Sort by timestamp descending
    results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    
    // Pagination
    const offset = filter.offset || 0
    const limit = filter.limit || 50
    results = results.slice(offset, offset + limit)
    
    return { entries: results, total }
  }
  
  verifyIntegrity(): { valid: boolean; brokenAt?: string } {
    let previousHash = 'genesis'
    
    for (const entry of this.entries) {
      if (entry.previousHash !== previousHash) {
        return { valid: false, brokenAt: entry.id }
      }
      
      const expectedHash = this.createHash({
        timestamp: entry.timestamp,
        action: entry.action,
        severity: entry.severity,
        context: entry.context,
        data: entry.data,
        id: entry.id,
        previousHash: entry.previousHash,
      })
      
      if (entry.hash !== expectedHash) {
        return { valid: false, brokenAt: entry.id }
      }
      
      previousHash = entry.hash
    }
    
    return { valid: true }
  }
  
  getStats(): {
    totalEntries: number
    byAction: Record<string, number>
    bySeverity: Record<string, number>
    oldestEntry?: string
    newestEntry?: string
  } {
    const byAction: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    
    for (const entry of this.entries) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1
    }
    
    return {
      totalEntries: this.entries.length,
      byAction,
      bySeverity,
      oldestEntry: this.entries[0]?.timestamp,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp,
    }
  }
  
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }
  
  private createHash(data: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 32)
  }
  
  private enforceRetention(): void {
    // Remove old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries)
    }
    
    // Remove entries older than retention period
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000)
    this.entries = this.entries.filter(e => 
      new Date(e.timestamp).getTime() > cutoff
    )
  }
}

const auditStore = new AuditStore()

// Severity mapping for actions
const ACTION_SEVERITY: Record<AuditAction, AuditSeverity> = {
  [AuditAction.LOGIN]: AuditSeverity.INFO,
  [AuditAction.LOGIN_FAILED]: AuditSeverity.WARN,
  [AuditAction.LOGOUT]: AuditSeverity.INFO,
  [AuditAction.LOGOUT_ALL]: AuditSeverity.INFO,
  [AuditAction.PASSWORD_CHANGE]: AuditSeverity.INFO,
  [AuditAction.PASSWORD_RESET]: AuditSeverity.WARN,
  [AuditAction.MFA_ENABLED]: AuditSeverity.INFO,
  [AuditAction.MFA_DISABLED]: AuditSeverity.WARN,
  [AuditAction.CREATE]: AuditSeverity.INFO,
  [AuditAction.READ]: AuditSeverity.DEBUG,
  [AuditAction.READ_LIST]: AuditSeverity.DEBUG,
  [AuditAction.UPDATE]: AuditSeverity.INFO,
  [AuditAction.DELETE]: AuditSeverity.WARN,
  [AuditAction.SOFT_DELETE]: AuditSeverity.INFO,
  [AuditAction.RESTORE]: AuditSeverity.INFO,
  [AuditAction.USER_CREATE]: AuditSeverity.INFO,
  [AuditAction.USER_UPDATE]: AuditSeverity.INFO,
  [AuditAction.USER_DELETE]: AuditSeverity.CRITICAL,
  [AuditAction.ROLE_CHANGE]: AuditSeverity.WARN,
  [AuditAction.PERMISSION_GRANT]: AuditSeverity.WARN,
  [AuditAction.PERMISSION_REVOKE]: AuditSeverity.WARN,
  [AuditAction.ACCOUNT_UNLOCK]: AuditSeverity.INFO,
  [AuditAction.RATE_LIMIT_EXCEEDED]: AuditSeverity.WARN,
  [AuditAction.ACCOUNT_LOCKED]: AuditSeverity.WARN,
  [AuditAction.SUSPICIOUS_ACTIVITY]: AuditSeverity.CRITICAL,
  [AuditAction.TOKEN_REVOKED]: AuditSeverity.INFO,
  [AuditAction.EXPORT]: AuditSeverity.WARN,
  [AuditAction.IMPORT]: AuditSeverity.WARN,
  [AuditAction.BULK_UPDATE]: AuditSeverity.WARN,
  [AuditAction.BULK_DELETE]: AuditSeverity.CRITICAL,
}

/**
 * Log an audit event
 */
export function audit(
  action: AuditAction,
  context: AuditContext,
  data: AuditData,
  customSeverity?: AuditSeverity
): AuditEntry {
  const severity = customSeverity || ACTION_SEVERITY[action] || AuditSeverity.INFO
  
  const entry = auditStore.add({
    timestamp: new Date().toISOString(),
    action,
    severity,
    context,
    data,
  })
  
  // Also log to standard logger for immediate visibility
  const logData = {
    auditId: entry.id,
    action,
    entityType: data.entityType,
    entityId: data.entityId,
    userId: context.userId,
    ip: context.ipAddress,
  }
  
  switch (severity) {
    case AuditSeverity.DEBUG:
      log.debug('Audit event', logData)
      break
    case AuditSeverity.INFO:
      log.info('Audit event', logData)
      break
    case AuditSeverity.WARN:
      log.warn('Audit event', logData)
      break
    case AuditSeverity.CRITICAL:
      log.error('Critical audit event', logData)
      break
  }
  
  return entry
}

/**
 * Log a data change with before/after comparison
 */
export function auditChange(
  action: AuditAction.UPDATE,
  context: AuditContext,
  entityType: string,
  entityId: string | number,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): AuditEntry {
  // Calculate changes
  const changes: Record<string, { old: unknown; new: unknown }> = {}
  
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { old: before[key], new: after[key] }
    }
  }
  
  return audit(action, context, {
    entityType,
    entityId,
    before,
    after,
    changes,
  })
}

/**
 * Query audit logs
 */
export function queryAuditLogs(filter: Parameters<typeof auditStore.query>[0]) {
  return auditStore.query(filter)
}

/**
 * Verify audit log integrity
 */
export function verifyAuditIntegrity() {
  return auditStore.verifyIntegrity()
}

/**
 * Get audit statistics
 */
export function getAuditStats() {
  return auditStore.getStats()
}

/**
 * Middleware helper to create context from request
 */
export function createAuditContext(
  c: { req: { header: (name: string) => string | undefined }; get: (key: string) => unknown }
): AuditContext {
  const user = c.get('user') as { id?: number; email?: string; role?: string } | undefined
  
  return {
    userId: user?.id,
    userEmail: user?.email,
    userRole: user?.role,
    ipAddress: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 
               c.req.header('x-real-ip') || 
               'unknown',
    userAgent: c.req.header('user-agent'),
    requestId: c.get('requestId') as string | undefined,
    sessionId: c.get('sessionId') as string | undefined,
  }
}
