/**
 * MFA / Biometric Preparedness Module
 * 
 * Implements infrastructure for future MFA support:
 * - TOTP (Time-based One-Time Password)
 * - WebAuthn/FIDO2 (Biometric)
 * - Recovery codes
 * - MFA enrollment flow
 */

import { createHmac, randomBytes, createHash } from 'crypto'
import { logger } from '../logger'

const log = logger.child({ module: 'mfa' })

// MFA Configuration
const MFA_CONFIG = {
  totp: {
    // TOTP settings (RFC 6238)
    algorithm: 'sha1' as const,  // Most authenticator apps use SHA1
    digits: 6,
    period: 30,                   // 30 second windows
    window: 1,                    // Allow 1 window before/after for clock drift
    issuer: process.env.MFA_ISSUER || 'Inmobiliaria System',
  },
  recovery: {
    codeCount: 10,               // Generate 10 recovery codes
    codeLength: 8,               // 8 character codes
  },
  webauthn: {
    rpName: 'Inmobiliaria System',
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
  },
}

export enum MFAMethod {
  TOTP = 'totp',
  WEBAUTHN = 'webauthn',
  SMS = 'sms',           // Not recommended, but common
  EMAIL = 'email',       // Backup method
  RECOVERY = 'recovery', // Recovery codes
}

export interface MFAEnrollment {
  userId: number
  method: MFAMethod
  secret?: string        // For TOTP
  credentialId?: string  // For WebAuthn
  createdAt: Date
  lastUsedAt?: Date
  enabled: boolean
}

export interface MFAChallenge {
  challengeId: string
  userId: number
  method: MFAMethod
  challenge: string
  expiresAt: Date
  verified: boolean
}

// In-memory store (use database in production)
class MFAStore {
  private enrollments = new Map<number, MFAEnrollment[]>()
  private challenges = new Map<string, MFAChallenge>()
  private recoveryCodes = new Map<number, string[]>() // userId -> hashed codes

  // Enrollment management
  addEnrollment(enrollment: MFAEnrollment): void {
    let userEnrollments = this.enrollments.get(enrollment.userId)
    if (!userEnrollments) {
      userEnrollments = []
      this.enrollments.set(enrollment.userId, userEnrollments)
    }
    userEnrollments.push(enrollment)
  }

  getEnrollments(userId: number): MFAEnrollment[] {
    return this.enrollments.get(userId) || []
  }

  getEnrollmentByMethod(userId: number, method: MFAMethod): MFAEnrollment | undefined {
    return this.getEnrollments(userId).find(e => e.method === method && e.enabled)
  }

  hasEnabledMFA(userId: number): boolean {
    return this.getEnrollments(userId).some(e => e.enabled)
  }

  disableEnrollment(userId: number, method: MFAMethod): boolean {
    const enrollment = this.getEnrollmentByMethod(userId, method)
    if (enrollment) {
      enrollment.enabled = false
      return true
    }
    return false
  }

  // Challenge management
  createChallenge(challenge: MFAChallenge): void {
    this.challenges.set(challenge.challengeId, challenge)
  }

  getChallenge(challengeId: string): MFAChallenge | undefined {
    return this.challenges.get(challengeId)
  }

  verifyChallenge(challengeId: string): boolean {
    const challenge = this.challenges.get(challengeId)
    if (challenge) {
      challenge.verified = true
      return true
    }
    return false
  }

  // Recovery codes
  setRecoveryCodes(userId: number, hashedCodes: string[]): void {
    this.recoveryCodes.set(userId, hashedCodes)
  }

  getRecoveryCodes(userId: number): string[] {
    return this.recoveryCodes.get(userId) || []
  }

  useRecoveryCode(userId: number, codeHash: string): boolean {
    const codes = this.recoveryCodes.get(userId)
    if (!codes) return false
    
    const index = codes.indexOf(codeHash)
    if (index === -1) return false
    
    codes.splice(index, 1)
    return true
  }
}

const mfaStore = new MFAStore()

// TOTP Implementation

/**
 * Generate a random base32 secret for TOTP
 */
export function generateTOTPSecret(): string {
  const buffer = randomBytes(20)
  return base32Encode(buffer)
}

/**
 * Generate TOTP code for a given secret and time
 */
export function generateTOTP(secret: string, time?: number): string {
  const currentTime = time ?? Math.floor(Date.now() / 1000)
  const counter = Math.floor(currentTime / MFA_CONFIG.totp.period)
  
  const secretBuffer = base32Decode(secret)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))
  
  const hmac = createHmac(MFA_CONFIG.totp.algorithm, secretBuffer)
  hmac.update(counterBuffer)
  const hash = hmac.digest()
  
  // Dynamic truncation
  const offset = hash[hash.length - 1]! & 0x0f
  const binary = (
    ((hash[offset]! & 0x7f) << 24) |
    ((hash[offset + 1]! & 0xff) << 16) |
    ((hash[offset + 2]! & 0xff) << 8) |
    (hash[offset + 3]! & 0xff)
  )
  
  const otp = binary % Math.pow(10, MFA_CONFIG.totp.digits)
  return otp.toString().padStart(MFA_CONFIG.totp.digits, '0')
}

/**
 * Verify a TOTP code
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const currentTime = Math.floor(Date.now() / 1000)
  
  // Check current window and adjacent windows for clock drift
  for (let i = -MFA_CONFIG.totp.window; i <= MFA_CONFIG.totp.window; i++) {
    const checkTime = currentTime + (i * MFA_CONFIG.totp.period)
    const expectedCode = generateTOTP(secret, checkTime)
    
    if (expectedCode === code) {
      return true
    }
  }
  
  return false
}

/**
 * Generate TOTP provisioning URI (for QR codes)
 */
export function generateTOTPUri(
  secret: string,
  accountName: string
): string {
  const { issuer, algorithm, digits, period } = MFA_CONFIG.totp
  
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: algorithm.toUpperCase(),
    digits: digits.toString(),
    period: period.toString(),
  })
  
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params.toString()}`
}

// Recovery Codes

/**
 * Generate recovery codes
 */
export function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = []
  const hashes: string[] = []
  
  for (let i = 0; i < MFA_CONFIG.recovery.codeCount; i++) {
    const code = randomBytes(MFA_CONFIG.recovery.codeLength / 2)
      .toString('hex')
      .toUpperCase()
    
    // Format as XXXX-XXXX for readability
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`
    codes.push(formatted)
    
    // Store hash only
    const hash = createHash('sha256').update(code).digest('hex')
    hashes.push(hash)
  }
  
  return { codes, hashes }
}

/**
 * Verify a recovery code
 */
export function verifyRecoveryCode(userId: number, code: string): boolean {
  // Normalize code (remove dashes, uppercase)
  const normalized = code.replace(/-/g, '').toUpperCase()
  const hash = createHash('sha256').update(normalized).digest('hex')
  
  return mfaStore.useRecoveryCode(userId, hash)
}

// Enrollment flows

/**
 * Start TOTP enrollment
 */
export function startTOTPEnrollment(userId: number, email: string): {
  secret: string
  uri: string
  challengeId: string
} {
  const secret = generateTOTPSecret()
  const uri = generateTOTPUri(secret, email)
  const challengeId = randomBytes(16).toString('hex')
  
  // Store pending enrollment as a challenge
  mfaStore.createChallenge({
    challengeId,
    userId,
    method: MFAMethod.TOTP,
    challenge: secret, // Store secret in challenge temporarily
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    verified: false,
  })
  
  log.info('TOTP enrollment started', { userId, challengeId })
  
  return { secret, uri, challengeId }
}

/**
 * Complete TOTP enrollment
 */
export function completeTOTPEnrollment(
  challengeId: string,
  code: string
): { success: boolean; recoveryCodes?: string[]; error?: string } {
  const challenge = mfaStore.getChallenge(challengeId)
  
  if (!challenge) {
    return { success: false, error: 'Invalid or expired enrollment' }
  }
  
  if (challenge.expiresAt < new Date()) {
    return { success: false, error: 'Enrollment expired' }
  }
  
  // Verify the code with the pending secret
  if (!verifyTOTP(challenge.challenge, code)) {
    return { success: false, error: 'Invalid verification code' }
  }
  
  // Create enrollment
  mfaStore.addEnrollment({
    userId: challenge.userId,
    method: MFAMethod.TOTP,
    secret: challenge.challenge,
    createdAt: new Date(),
    enabled: true,
  })
  
  // Generate recovery codes
  const { codes, hashes } = generateRecoveryCodes()
  mfaStore.setRecoveryCodes(challenge.userId, hashes)
  
  // Mark challenge as verified
  mfaStore.verifyChallenge(challengeId)
  
  log.info('TOTP enrollment completed', { userId: challenge.userId })
  
  return { success: true, recoveryCodes: codes }
}

/**
 * Verify MFA during login
 */
export function verifyMFA(
  userId: number,
  method: MFAMethod,
  code: string
): { success: boolean; error?: string } {
  if (method === MFAMethod.RECOVERY) {
    if (verifyRecoveryCode(userId, code)) {
      log.info('Recovery code used', { userId })
      return { success: true }
    }
    return { success: false, error: 'Invalid recovery code' }
  }
  
  if (method === MFAMethod.TOTP) {
    const enrollment = mfaStore.getEnrollmentByMethod(userId, MFAMethod.TOTP)
    if (!enrollment?.secret) {
      return { success: false, error: 'TOTP not enrolled' }
    }
    
    if (verifyTOTP(enrollment.secret, code)) {
      enrollment.lastUsedAt = new Date()
      log.info('TOTP verified', { userId })
      return { success: true }
    }
    return { success: false, error: 'Invalid code' }
  }
  
  return { success: false, error: 'Unsupported MFA method' }
}

/**
 * Check if user has MFA enabled
 */
export function isMFAEnabled(userId: number): boolean {
  return mfaStore.hasEnabledMFA(userId)
}

/**
 * Get user's enabled MFA methods
 */
export function getEnabledMFAMethods(userId: number): MFAMethod[] {
  return mfaStore.getEnrollments(userId)
    .filter(e => e.enabled)
    .map(e => e.method)
}

/**
 * Disable MFA for a user
 */
export function disableMFA(userId: number, method: MFAMethod): boolean {
  const result = mfaStore.disableEnrollment(userId, method)
  if (result) {
    log.info('MFA disabled', { userId, method })
  }
  return result
}

// Base32 helpers (for TOTP)

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let result = ''
  let bits = 0
  let value = 0
  
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31]
  }
  
  return result
}

function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '')
  
  const bytes: number[] = []
  let bits = 0
  let value = 0
  
  for (const char of cleaned) {
    const index = alphabet.indexOf(char)
    if (index === -1) continue
    
    value = (value << 5) | index
    bits += 5
    
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  
  return Buffer.from(bytes)
}

export { MFA_CONFIG, mfaStore }
