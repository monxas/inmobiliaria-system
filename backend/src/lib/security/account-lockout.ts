/**
 * Account Lockout Policy
 * 
 * Implements:
 * - Progressive account lockout after failed attempts
 * - Configurable thresholds and durations
 * - IP-based and user-based tracking
 * - Automatic unlock after duration
 * - Admin manual unlock capability
 */

import { logger } from '../logger'

const log = logger.child({ module: 'account-lockout' })

// Configuration
const LOCKOUT_CONFIG = {
  // Maximum failed attempts before lockout
  maxAttempts: Number(process.env.LOCKOUT_MAX_ATTEMPTS) || 5,
  
  // Progressive lockout durations (milliseconds)
  lockoutDurations: [
    5 * 60 * 1000,      // 5 minutes after first lockout
    15 * 60 * 1000,     // 15 minutes
    60 * 60 * 1000,     // 1 hour
    4 * 60 * 60 * 1000, // 4 hours
    24 * 60 * 60 * 1000,// 24 hours (max)
  ],
  
  // Window to count failed attempts (resets after this with no failures)
  attemptWindowMs: 15 * 60 * 1000, // 15 minutes
  
  // Whether to track by IP in addition to email
  trackByIP: true,
}

interface LockoutEntry {
  failedAttempts: number
  lastFailedAt: number
  lockoutCount: number     // How many times they've been locked out
  lockedUntil: number | null
  ipAddresses: Set<string>
}

// In-memory store (use Redis in production)
class LockoutStore {
  private entries = new Map<string, LockoutEntry>()
  private ipToUsers = new Map<string, Set<string>>() // Track IPs trying multiple accounts
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  get(key: string): LockoutEntry | undefined {
    return this.entries.get(key)
  }

  set(key: string, entry: LockoutEntry): void {
    this.entries.set(key, entry)
  }

  delete(key: string): void {
    this.entries.delete(key)
  }

  trackIPUserAttempt(ip: string, userId: string): void {
    if (!LOCKOUT_CONFIG.trackByIP) return
    
    let users = this.ipToUsers.get(ip)
    if (!users) {
      users = new Set()
      this.ipToUsers.set(ip, users)
    }
    users.add(userId)
  }

  /**
   * Check if an IP is attempting multiple accounts (credential stuffing detection)
   */
  isCredentialStuffing(ip: string): boolean {
    const users = this.ipToUsers.get(ip)
    return users ? users.size > 10 : false // More than 10 accounts from same IP
  }

  private cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.entries) {
      // Clean up entries that have expired and have no lockout
      if (!entry.lockedUntil && 
          now - entry.lastFailedAt > LOCKOUT_CONFIG.attemptWindowMs * 2) {
        this.entries.delete(key)
      }
    }

    // Clean up old IP tracking
    for (const [ip, users] of this.ipToUsers) {
      if (users.size === 0) {
        this.ipToUsers.delete(ip)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.entries.clear()
    this.ipToUsers.clear()
  }

  getStats(): { lockedAccounts: number; trackedIPs: number } {
    const now = Date.now()
    let lockedAccounts = 0
    
    for (const entry of this.entries.values()) {
      if (entry.lockedUntil && entry.lockedUntil > now) {
        lockedAccounts++
      }
    }
    
    return {
      lockedAccounts,
      trackedIPs: this.ipToUsers.size,
    }
  }
}

const store = new LockoutStore()

export interface LockoutStatus {
  isLocked: boolean
  remainingAttempts: number
  lockedUntil: Date | null
  lockoutDuration: number | null // seconds
  lockoutCount: number
}

export interface LockoutResult {
  success: boolean
  shouldBlock: boolean
  status: LockoutStatus
  reason?: string
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(
  identifier: string,
  ipAddress?: string
): LockoutResult {
  const now = Date.now()
  let entry = store.get(identifier)

  if (!entry) {
    entry = {
      failedAttempts: 0,
      lastFailedAt: now,
      lockoutCount: 0,
      lockedUntil: null,
      ipAddresses: new Set(),
    }
  }

  // Check if currently locked
  if (entry.lockedUntil && entry.lockedUntil > now) {
    const remainingMs = entry.lockedUntil - now
    log.warn('Login attempt on locked account', { 
      identifier, 
      remainingSeconds: Math.ceil(remainingMs / 1000),
      ip: ipAddress 
    })
    
    return {
      success: false,
      shouldBlock: true,
      status: {
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: new Date(entry.lockedUntil),
        lockoutDuration: Math.ceil(remainingMs / 1000),
        lockoutCount: entry.lockoutCount,
      },
      reason: 'Account is locked',
    }
  }

  // Check if attempt window has passed (reset counter)
  if (now - entry.lastFailedAt > LOCKOUT_CONFIG.attemptWindowMs) {
    entry.failedAttempts = 0
  }

  // Record the attempt
  entry.failedAttempts++
  entry.lastFailedAt = now
  
  if (ipAddress) {
    entry.ipAddresses.add(ipAddress)
    store.trackIPUserAttempt(ipAddress, identifier)
  }

  // Check for lockout
  if (entry.failedAttempts >= LOCKOUT_CONFIG.maxAttempts) {
    // Calculate lockout duration based on number of previous lockouts
    const durationIndex = Math.min(
      entry.lockoutCount,
      LOCKOUT_CONFIG.lockoutDurations.length - 1
    )
    const lockoutDuration = LOCKOUT_CONFIG.lockoutDurations[durationIndex] || LOCKOUT_CONFIG.lockoutDurations[0] || 5 * 60 * 1000
    
    entry.lockedUntil = now + lockoutDuration
    entry.lockoutCount++
    entry.failedAttempts = 0 // Reset for next cycle
    
    store.set(identifier, entry)
    
    log.warn('Account locked due to failed attempts', {
      identifier,
      lockoutCount: entry.lockoutCount,
      lockoutDurationMinutes: lockoutDuration / 60000,
      ip: ipAddress,
      uniqueIPs: entry.ipAddresses.size,
    })
    
    return {
      success: false,
      shouldBlock: true,
      status: {
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: new Date(entry.lockedUntil),
        lockoutDuration: Math.ceil(lockoutDuration / 1000),
        lockoutCount: entry.lockoutCount,
      },
      reason: 'Too many failed attempts. Account locked.',
    }
  }

  store.set(identifier, entry)
  
  const remainingAttempts = LOCKOUT_CONFIG.maxAttempts - entry.failedAttempts
  
  log.debug('Failed login attempt recorded', { 
    identifier, 
    failedAttempts: entry.failedAttempts,
    remainingAttempts,
    ip: ipAddress 
  })

  return {
    success: false,
    shouldBlock: false,
    status: {
      isLocked: false,
      remainingAttempts,
      lockedUntil: null,
      lockoutDuration: null,
      lockoutCount: entry.lockoutCount,
    },
  }
}

/**
 * Check if an account is currently locked
 */
export function checkLockoutStatus(identifier: string): LockoutStatus {
  const entry = store.get(identifier)
  const now = Date.now()

  if (!entry) {
    return {
      isLocked: false,
      remainingAttempts: LOCKOUT_CONFIG.maxAttempts,
      lockedUntil: null,
      lockoutDuration: null,
      lockoutCount: 0,
    }
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockedUntil: new Date(entry.lockedUntil),
      lockoutDuration: Math.ceil((entry.lockedUntil - now) / 1000),
      lockoutCount: entry.lockoutCount,
    }
  }

  // Check if attempt window has passed
  const attemptsInWindow = 
    now - entry.lastFailedAt <= LOCKOUT_CONFIG.attemptWindowMs 
      ? entry.failedAttempts 
      : 0

  return {
    isLocked: false,
    remainingAttempts: LOCKOUT_CONFIG.maxAttempts - attemptsInWindow,
    lockedUntil: null,
    lockoutDuration: null,
    lockoutCount: entry.lockoutCount,
  }
}

/**
 * Clear lockout and failed attempts on successful login
 */
export function clearOnSuccessfulLogin(identifier: string): void {
  const entry = store.get(identifier)
  
  if (entry) {
    log.info('Lockout cleared on successful login', { 
      identifier,
      previousFailedAttempts: entry.failedAttempts,
      previousLockoutCount: entry.lockoutCount 
    })
  }
  
  store.delete(identifier)
}

/**
 * Manually unlock an account (admin action)
 */
export function adminUnlock(identifier: string, adminId: number): boolean {
  const entry = store.get(identifier)
  
  if (!entry) {
    return false
  }
  
  log.info('Account manually unlocked by admin', {
    identifier,
    adminId,
    lockoutCount: entry.lockoutCount,
  })
  
  store.delete(identifier)
  return true
}

/**
 * Check for credential stuffing attack from IP
 */
export function checkCredentialStuffing(ipAddress: string): boolean {
  return store.isCredentialStuffing(ipAddress)
}

/**
 * Get lockout statistics
 */
export function getLockoutStats() {
  return store.getStats()
}

export { LOCKOUT_CONFIG }
