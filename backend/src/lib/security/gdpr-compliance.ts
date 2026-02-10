/**
 * GDPR Compliance Framework
 * 
 * Implements:
 * - Data subject rights (access, rectification, erasure, portability)
 * - Consent management
 * - Data processing records
 * - Privacy by design patterns
 * - Breach notification framework
 */

import { createHash } from 'crypto'
import { logger } from '../logger'
import { maskSensitiveData } from './data-masking'

const log = logger.child({ module: 'gdpr' })

// GDPR Rights
export enum GDPRRight {
  ACCESS = 'access',               // Art. 15 - Right of access
  RECTIFICATION = 'rectification', // Art. 16 - Right to rectification
  ERASURE = 'erasure',             // Art. 17 - Right to erasure
  RESTRICTION = 'restriction',     // Art. 18 - Right to restriction
  PORTABILITY = 'portability',     // Art. 20 - Right to data portability
  OBJECT = 'object',               // Art. 21 - Right to object
}

// Legal bases for processing
export enum LegalBasis {
  CONSENT = 'consent',                   // Art. 6(1)(a)
  CONTRACT = 'contract',                 // Art. 6(1)(b)
  LEGAL_OBLIGATION = 'legal_obligation', // Art. 6(1)(c)
  VITAL_INTERESTS = 'vital_interests',   // Art. 6(1)(d)
  PUBLIC_TASK = 'public_task',           // Art. 6(1)(e)
  LEGITIMATE_INTEREST = 'legitimate_interest', // Art. 6(1)(f)
}

// Data categories
export enum DataCategory {
  BASIC_IDENTITY = 'basic_identity',     // Name, contact info
  FINANCIAL = 'financial',               // Bank details, payments
  LOCATION = 'location',                 // Address, GPS
  BEHAVIORAL = 'behavioral',             // Usage patterns
  COMMUNICATIONS = 'communications',     // Messages, calls
  SENSITIVE = 'sensitive',               // Special categories Art. 9
}

// Consent record
export interface ConsentRecord {
  id: string
  userId: number
  purpose: string
  legalBasis: LegalBasis
  dataCategories: DataCategory[]
  granted: boolean
  grantedAt?: Date
  revokedAt?: Date
  expiresAt?: Date
  ipAddress?: string
  userAgent?: string
  version: string  // Version of privacy policy at consent time
}

// Data subject request
export interface DataSubjectRequest {
  id: string
  userId: number
  right: GDPRRight
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  requestedAt: Date
  completedAt?: Date
  responseDeadline: Date  // Must respond within 30 days
  notes?: string
  result?: unknown
}

// Processing activity record (Art. 30)
export interface ProcessingActivityRecord {
  id: string
  name: string
  purpose: string
  legalBasis: LegalBasis
  dataCategories: DataCategory[]
  dataSubjects: string[]     // Categories of data subjects
  recipients: string[]       // Categories of recipients
  retentionPeriod: string
  securityMeasures: string[]
  transfersOutsideEU?: {
    country: string
    safeguards: string
  }[]
  createdAt: Date
  updatedAt: Date
}

// Data breach record
export interface DataBreachRecord {
  id: string
  detectedAt: Date
  reportedAt?: Date
  nature: string
  dataCategories: DataCategory[]
  approximateRecords: number
  consequences: string
  measuresToken: string[]
  notifiedAuthority: boolean
  notifiedSubjects: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

// In-memory stores (use database in production)
class GDPRStore {
  private consents = new Map<string, ConsentRecord>()
  private userConsents = new Map<number, Set<string>>()
  private requests = new Map<string, DataSubjectRequest>()
  private processingActivities = new Map<string, ProcessingActivityRecord>()
  private breaches = new Map<string, DataBreachRecord>()

  // Consent management
  recordConsent(consent: ConsentRecord): void {
    this.consents.set(consent.id, consent)
    
    let userSet = this.userConsents.get(consent.userId)
    if (!userSet) {
      userSet = new Set()
      this.userConsents.set(consent.userId, userSet)
    }
    userSet.add(consent.id)
  }

  getConsent(id: string): ConsentRecord | undefined {
    return this.consents.get(id)
  }

  getUserConsents(userId: number): ConsentRecord[] {
    const ids = this.userConsents.get(userId)
    if (!ids) return []
    
    const consents: ConsentRecord[] = []
    for (const id of ids) {
      const consent = this.consents.get(id)
      if (consent) consents.push(consent)
    }
    return consents
  }

  hasValidConsent(userId: number, purpose: string): boolean {
    const consents = this.getUserConsents(userId)
    const now = new Date()
    
    return consents.some(c => 
      c.purpose === purpose &&
      c.granted &&
      !c.revokedAt &&
      (!c.expiresAt || c.expiresAt > now)
    )
  }

  revokeConsent(id: string): boolean {
    const consent = this.consents.get(id)
    if (!consent || !consent.granted) return false
    
    consent.revokedAt = new Date()
    return true
  }

  // Data subject requests
  createRequest(request: DataSubjectRequest): void {
    this.requests.set(request.id, request)
  }

  getRequest(id: string): DataSubjectRequest | undefined {
    return this.requests.get(id)
  }

  getUserRequests(userId: number): DataSubjectRequest[] {
    return Array.from(this.requests.values())
      .filter(r => r.userId === userId)
  }

  updateRequest(id: string, updates: Partial<DataSubjectRequest>): boolean {
    const request = this.requests.get(id)
    if (!request) return false
    
    Object.assign(request, updates)
    return true
  }

  // Processing activities
  recordActivity(activity: ProcessingActivityRecord): void {
    this.processingActivities.set(activity.id, activity)
  }

  getActivities(): ProcessingActivityRecord[] {
    return Array.from(this.processingActivities.values())
  }

  // Breaches
  recordBreach(breach: DataBreachRecord): void {
    this.breaches.set(breach.id, breach)
  }

  getBreaches(): DataBreachRecord[] {
    return Array.from(this.breaches.values())
  }
}

const gdprStore = new GDPRStore()

/**
 * Record user consent
 */
export function recordConsent(
  userId: number,
  purpose: string,
  legalBasis: LegalBasis,
  dataCategories: DataCategory[],
  granted: boolean,
  context?: { ipAddress?: string; userAgent?: string; policyVersion?: string }
): ConsentRecord {
  const consent: ConsentRecord = {
    id: `consent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId,
    purpose,
    legalBasis,
    dataCategories,
    granted,
    grantedAt: granted ? new Date() : undefined,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    version: context?.policyVersion || '1.0',
  }
  
  gdprStore.recordConsent(consent)
  
  log.info('Consent recorded', { 
    userId, 
    purpose, 
    granted,
    id: consent.id 
  })
  
  return consent
}

/**
 * Check if user has valid consent for a purpose
 */
export function hasConsent(userId: number, purpose: string): boolean {
  return gdprStore.hasValidConsent(userId, purpose)
}

/**
 * Revoke consent
 */
export function revokeConsent(consentId: string): boolean {
  const result = gdprStore.revokeConsent(consentId)
  if (result) {
    log.info('Consent revoked', { consentId })
  }
  return result
}

/**
 * Create a data subject request
 */
export function createDataSubjectRequest(
  userId: number,
  right: GDPRRight
): DataSubjectRequest {
  const request: DataSubjectRequest = {
    id: `dsr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId,
    right,
    status: 'pending',
    requestedAt: new Date(),
    responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  }
  
  gdprStore.createRequest(request)
  
  log.info('Data subject request created', { 
    userId, 
    right,
    id: request.id,
    deadline: request.responseDeadline 
  })
  
  return request
}

/**
 * Process right to access request
 */
export async function processAccessRequest(
  requestId: string,
  dataFetcher: () => Promise<Record<string, unknown>>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const request = gdprStore.getRequest(requestId)
  if (!request || request.right !== GDPRRight.ACCESS) {
    return { success: false, error: 'Invalid request' }
  }
  
  gdprStore.updateRequest(requestId, { status: 'processing' })
  
  try {
    const data = await dataFetcher()
    
    // Mask any remaining sensitive operational data
    const safeData = maskSensitiveData(data, { maskPatterns: false })
    
    gdprStore.updateRequest(requestId, {
      status: 'completed',
      completedAt: new Date(),
      result: safeData,
    })
    
    log.info('Access request completed', { requestId })
    
    return { success: true, data: safeData }
  } catch (error) {
    log.error('Access request failed', { requestId, error })
    return { success: false, error: 'Failed to retrieve data' }
  }
}

/**
 * Process right to erasure request
 */
export async function processErasureRequest(
  requestId: string,
  eraser: () => Promise<{ deleted: string[]; retained: string[] }>
): Promise<{ success: boolean; deleted?: string[]; retained?: string[]; error?: string }> {
  const request = gdprStore.getRequest(requestId)
  if (!request || request.right !== GDPRRight.ERASURE) {
    return { success: false, error: 'Invalid request' }
  }
  
  gdprStore.updateRequest(requestId, { status: 'processing' })
  
  try {
    const result = await eraser()
    
    gdprStore.updateRequest(requestId, {
      status: 'completed',
      completedAt: new Date(),
      result,
      notes: result.retained.length > 0 
        ? `Some data retained for legal obligations: ${result.retained.join(', ')}`
        : 'All personal data deleted',
    })
    
    log.info('Erasure request completed', { 
      requestId,
      deleted: result.deleted.length,
      retained: result.retained.length 
    })
    
    return { success: true, ...result }
  } catch (error) {
    log.error('Erasure request failed', { requestId, error })
    return { success: false, error: 'Failed to delete data' }
  }
}

/**
 * Process right to portability request
 */
export async function processPortabilityRequest(
  requestId: string,
  dataFetcher: () => Promise<Record<string, unknown>>
): Promise<{ success: boolean; data?: string; format?: string; error?: string }> {
  const request = gdprStore.getRequest(requestId)
  if (!request || request.right !== GDPRRight.PORTABILITY) {
    return { success: false, error: 'Invalid request' }
  }
  
  gdprStore.updateRequest(requestId, { status: 'processing' })
  
  try {
    const data = await dataFetcher()
    
    // Export in machine-readable format (JSON)
    const exportData = JSON.stringify(data, null, 2)
    
    gdprStore.updateRequest(requestId, {
      status: 'completed',
      completedAt: new Date(),
    })
    
    log.info('Portability request completed', { requestId })
    
    return { success: true, data: exportData, format: 'application/json' }
  } catch (error) {
    log.error('Portability request failed', { requestId, error })
    return { success: false, error: 'Failed to export data' }
  }
}

/**
 * Record a processing activity (Art. 30)
 */
export function recordProcessingActivity(
  activity: Omit<ProcessingActivityRecord, 'id' | 'createdAt' | 'updatedAt'>
): ProcessingActivityRecord {
  const record: ProcessingActivityRecord = {
    ...activity,
    id: `activity_${createHash('sha256').update(activity.name).digest('hex').substring(0, 8)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  gdprStore.recordActivity(record)
  
  log.info('Processing activity recorded', { id: record.id, name: record.name })
  
  return record
}

/**
 * Record a data breach
 */
export function recordDataBreach(
  breach: Omit<DataBreachRecord, 'id'>
): DataBreachRecord {
  const record: DataBreachRecord = {
    ...breach,
    id: `breach_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  }
  
  gdprStore.recordBreach(record)
  
  // High risk breaches must be reported within 72 hours
  if (record.riskLevel === 'high') {
    log.error('HIGH RISK DATA BREACH DETECTED', {
      id: record.id,
      nature: record.nature,
      approximateRecords: record.approximateRecords,
      message: 'Must notify supervisory authority within 72 hours',
    })
  } else {
    log.warn('Data breach recorded', {
      id: record.id,
      riskLevel: record.riskLevel,
    })
  }
  
  return record
}

/**
 * Get all data subject requests for a user
 */
export function getUserRequests(userId: number): DataSubjectRequest[] {
  return gdprStore.getUserRequests(userId)
}

/**
 * Get user consents
 */
export function getUserConsents(userId: number): ConsentRecord[] {
  return gdprStore.getUserConsents(userId)
}

/**
 * Generate processing activities report (for Art. 30)
 */
export function generateProcessingReport(): ProcessingActivityRecord[] {
  return gdprStore.getActivities()
}

/**
 * Privacy impact assessment helper
 */
export function assessPrivacyImpact(
  dataCategories: DataCategory[],
  processingType: string,
  dataVolume: 'low' | 'medium' | 'high'
): {
  riskLevel: 'low' | 'medium' | 'high'
  requiresDPIA: boolean
  recommendations: string[]
} {
  const recommendations: string[] = []
  let riskScore = 0
  
  // Check for sensitive data
  if (dataCategories.includes(DataCategory.SENSITIVE)) {
    riskScore += 3
    recommendations.push('Implement additional safeguards for sensitive data')
  }
  
  if (dataCategories.includes(DataCategory.FINANCIAL)) {
    riskScore += 2
    recommendations.push('Ensure PCI-DSS compliance for financial data')
  }
  
  if (dataCategories.includes(DataCategory.LOCATION)) {
    riskScore += 1
    recommendations.push('Minimize location data collection and retention')
  }
  
  // Volume impact
  if (dataVolume === 'high') riskScore += 2
  else if (dataVolume === 'medium') riskScore += 1
  
  // Processing type
  if (processingType.includes('automated decision')) {
    riskScore += 2
    recommendations.push('Implement human oversight for automated decisions')
  }
  
  const riskLevel = riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low'
  const requiresDPIA = riskLevel === 'high'
  
  if (requiresDPIA) {
    recommendations.push('Data Protection Impact Assessment (DPIA) is required')
  }
  
  return { riskLevel, requiresDPIA, recommendations }
}

// Data retention policy helper
export interface RetentionPolicy {
  dataCategory: DataCategory
  retentionPeriod: string
  legalBasis: string
  action: 'delete' | 'anonymize' | 'archive'
}

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    dataCategory: DataCategory.BASIC_IDENTITY,
    retentionPeriod: '3 years after relationship ends',
    legalBasis: 'Contract + Legal obligation',
    action: 'anonymize',
  },
  {
    dataCategory: DataCategory.FINANCIAL,
    retentionPeriod: '7 years (tax requirements)',
    legalBasis: 'Legal obligation',
    action: 'archive',
  },
  {
    dataCategory: DataCategory.COMMUNICATIONS,
    retentionPeriod: '1 year',
    legalBasis: 'Legitimate interest',
    action: 'delete',
  },
  {
    dataCategory: DataCategory.BEHAVIORAL,
    retentionPeriod: '6 months',
    legalBasis: 'Consent',
    action: 'delete',
  },
  {
    dataCategory: DataCategory.LOCATION,
    retentionPeriod: '30 days',
    legalBasis: 'Contract',
    action: 'delete',
  },
]

export { gdprStore }
