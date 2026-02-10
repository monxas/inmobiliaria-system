/**
 * Session Security Module
 * 
 * Implements:
 * - Concurrent session limits
 * - Device fingerprinting
 * - Session binding (IP, user agent)
 * - Automatic session cleanup
 * - Suspicious activity detection
 */

import { createHash } from 'crypto'
import { logger } from '../logger'

const log = logger.child({ module: 'session-security' })

// Configuration
const SESSION_CONFIG = {
  // Maximum concurrent sessions per user
  maxConcurrentSessions: Number(process.env.MAX_CONCURRENT_SESSIONS) || 5,
  
  // Maximum sessions per device fingerprint
  maxSessionsPerDevice: 2,
  
  // Session idle timeout (ms) - 30 minutes
  idleTimeoutMs: 30 * 60 * 1000,
  
  // Absolute session timeout (ms) - 24 hours
  absoluteTimeoutMs: 24 * 60 * 60 * 1000,
  
  // Track IP changes
  detectIPChanges: true,
  
  // Maximum IP changes before flagging
  maxIPChanges: 5,
  
  // Enable device binding
  bindToDevice: true,
}

export interface SessionInfo {
  sessionId: string
  userId: number
  deviceFingerprint: string
  ipAddress: string
  userAgent: string
  createdAt: number
  lastActivityAt: number
  ipHistory: string[]
  isActive: boolean
  metadata?: Record<string, unknown>
}

export interface SessionValidation {
  valid: boolean
  reason?: string
  shouldTerminate?: boolean
  newSession?: boolean
}

// In-memory session store (use Redis in production)
class SessionStore {
  private sessions = new Map<string, SessionInfo>()
  private userSessions = new Map<number, Set<string>>() // userId -> sessionIds
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  create(info: Omit<SessionInfo, 'isActive'>): SessionInfo {
    const session: SessionInfo = { ...info, isActive: true }
    this.sessions.set(info.sessionId, session)
    
    // Track by user
    let userSet = this.userSessions.get(info.userId)
    if (!userSet) {
      userSet = new Set()
      this.userSessions.set(info.userId, userSet)
    }
    userSet.add(info.sessionId)
    
    return session
  }

  get(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId)
  }

  update(sessionId: string, updates: Partial<SessionInfo>): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      Object.assign(session, updates)
    }
  }

  delete(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      const userSet = this.userSessions.get(session.userId)
      userSet?.delete(sessionId)
    }
    this.sessions.delete(sessionId)
  }

  getByUserId(userId: number): SessionInfo[] {
    const sessionIds = this.userSessions.get(userId)
    if (!sessionIds) return []
    
    const sessions: SessionInfo[] = []
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId)
      if (session && session.isActive) {
        sessions.push(session)
      }
    }
    return sessions
  }

  countByUserId(userId: number): number {
    return this.getByUserId(userId).filter(s => s.isActive).length
  }

  terminateAllForUser(userId: number): number {
    const sessionIds = this.userSessions.get(userId)
    if (!sessionIds) return 0
    
    let count = 0
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId)
      if (session && session.isActive) {
        session.isActive = false
        count++
      }
    }
    return count
  }

  terminateOldestForUser(userId: number): string | null {
    const sessions = this.getByUserId(userId)
    if (sessions.length === 0) return null
    
    // Sort by lastActivityAt, oldest first
    sessions.sort((a, b) => a.lastActivityAt - b.lastActivityAt)
    
    const oldest = sessions[0]
    if (oldest) {
      oldest.isActive = false
      return oldest.sessionId
    }
    return null
  }

  private cleanup(): void {
    const now = Date.now()
    
    for (const [sessionId, session] of this.sessions) {
      // Remove inactive sessions
      if (!session.isActive) {
        this.delete(sessionId)
        continue
      }
      
      // Check idle timeout
      if (now - session.lastActivityAt > SESSION_CONFIG.idleTimeoutMs) {
        log.info('Session terminated due to idle timeout', { 
          sessionId, 
          userId: session.userId 
        })
        session.isActive = false
        continue
      }
      
      // Check absolute timeout
      if (now - session.createdAt > SESSION_CONFIG.absoluteTimeoutMs) {
        log.info('Session terminated due to absolute timeout', { 
          sessionId, 
          userId: session.userId 
        })
        session.isActive = false
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.sessions.clear()
    this.userSessions.clear()
  }

  getStats(): {
    totalSessions: number
    activeSessions: number
    uniqueUsers: number
  } {
    let active = 0
    for (const session of this.sessions.values()) {
      if (session.isActive) active++
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: active,
      uniqueUsers: this.userSessions.size,
    }
  }
}

const sessionStore = new SessionStore()

/**
 * Generate a device fingerprint from user agent and other attributes
 */
export function generateDeviceFingerprint(
  userAgent: string,
  acceptLanguage?: string,
  acceptEncoding?: string
): string {
  const components = [
    userAgent,
    acceptLanguage || '',
    acceptEncoding || '',
  ].join('|')
  
  return createHash('sha256')
    .update(components)
    .digest('hex')
    .substring(0, 32)
}

/**
 * Create a new session
 */
export function createSession(
  userId: number,
  sessionId: string,
  ipAddress: string,
  userAgent: string,
  deviceFingerprint?: string
): { session: SessionInfo; terminated: string[] } {
  const fingerprint = deviceFingerprint || generateDeviceFingerprint(userAgent)
  const terminated: string[] = []
  
  // Check concurrent session limit
  const currentCount = sessionStore.countByUserId(userId)
  
  if (currentCount >= SESSION_CONFIG.maxConcurrentSessions) {
    // Terminate oldest session
    const oldestId = sessionStore.terminateOldestForUser(userId)
    if (oldestId) {
      terminated.push(oldestId)
      log.info('Terminated oldest session due to limit', { 
        userId, 
        terminatedSessionId: oldestId 
      })
    }
  }
  
  const session = sessionStore.create({
    sessionId,
    userId,
    deviceFingerprint: fingerprint,
    ipAddress,
    userAgent,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ipHistory: [ipAddress],
  })
  
  log.info('Session created', { 
    sessionId, 
    userId, 
    ip: ipAddress,
    currentSessions: currentCount + 1 - terminated.length 
  })
  
  return { session, terminated }
}

/**
 * Validate an existing session
 */
export function validateSession(
  sessionId: string,
  ipAddress: string,
  userAgent: string
): SessionValidation {
  const session = sessionStore.get(sessionId)
  
  if (!session) {
    return { valid: false, reason: 'Session not found', newSession: true }
  }
  
  if (!session.isActive) {
    return { valid: false, reason: 'Session is not active', shouldTerminate: true }
  }
  
  const now = Date.now()
  
  // Check idle timeout
  if (now - session.lastActivityAt > SESSION_CONFIG.idleTimeoutMs) {
    session.isActive = false
    return { valid: false, reason: 'Session expired (idle)', shouldTerminate: true }
  }
  
  // Check absolute timeout
  if (now - session.createdAt > SESSION_CONFIG.absoluteTimeoutMs) {
    session.isActive = false
    return { valid: false, reason: 'Session expired (absolute)', shouldTerminate: true }
  }
  
  // Check device binding
  if (SESSION_CONFIG.bindToDevice) {
    const currentFingerprint = generateDeviceFingerprint(userAgent)
    if (currentFingerprint !== session.deviceFingerprint) {
      log.warn('Device fingerprint mismatch', {
        sessionId,
        userId: session.userId,
        expected: session.deviceFingerprint,
        got: currentFingerprint,
      })
      // Don't terminate, but flag for additional verification
      // return { valid: false, reason: 'Device mismatch', shouldTerminate: true }
    }
  }
  
  // Check IP changes
  if (SESSION_CONFIG.detectIPChanges && ipAddress !== session.ipAddress) {
    if (!session.ipHistory.includes(ipAddress)) {
      session.ipHistory.push(ipAddress)
      
      if (session.ipHistory.length > SESSION_CONFIG.maxIPChanges) {
        log.warn('Excessive IP changes detected', {
          sessionId,
          userId: session.userId,
          ipCount: session.ipHistory.length,
        })
        // Flag but don't terminate - might be mobile user
      }
    }
    session.ipAddress = ipAddress
  }
  
  // Update last activity
  session.lastActivityAt = now
  
  return { valid: true }
}

/**
 * Update session activity
 */
export function updateSessionActivity(sessionId: string): void {
  sessionStore.update(sessionId, { lastActivityAt: Date.now() })
}

/**
 * Terminate a session
 */
export function terminateSession(sessionId: string): boolean {
  const session = sessionStore.get(sessionId)
  if (!session) return false
  
  session.isActive = false
  log.info('Session terminated', { sessionId, userId: session.userId })
  return true
}

/**
 * Terminate all sessions for a user
 */
export function terminateAllUserSessions(userId: number): number {
  const count = sessionStore.terminateAllForUser(userId)
  log.info('All sessions terminated for user', { userId, count })
  return count
}

/**
 * Get active sessions for a user
 */
export function getUserSessions(userId: number): SessionInfo[] {
  return sessionStore.getByUserId(userId)
}

/**
 * Get session statistics
 */
export function getSessionStats() {
  return sessionStore.getStats()
}

/**
 * Detect suspicious session activity
 */
export function detectSuspiciousActivity(
  userId: number,
  _currentIP: string,
  _currentUserAgent: string
): { suspicious: boolean; reasons: string[] } {
  const sessions = sessionStore.getByUserId(userId)
  const reasons: string[] = []
  
  // Check for simultaneous sessions from different locations
  const uniqueIPs = new Set(sessions.map(s => s.ipAddress))
  if (uniqueIPs.size > 3) {
    reasons.push(`Sessions from ${uniqueIPs.size} different IPs`)
  }
  
  // Check for rapid session creation
  const recentSessions = sessions.filter(s => 
    Date.now() - s.createdAt < 5 * 60 * 1000 // Last 5 minutes
  )
  if (recentSessions.length > 3) {
    reasons.push(`${recentSessions.length} sessions created in last 5 minutes`)
  }
  
  // Check for impossible travel (very different IPs in short time)
  // This would need GeoIP lookup in production
  
  return {
    suspicious: reasons.length > 0,
    reasons,
  }
}

export { SESSION_CONFIG, sessionStore }
