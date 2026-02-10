/**
 * @fileoverview File validation utilities using magic bytes detection.
 * 
 * Security features:
 * - MIME type validation via file signatures (magic bytes)
 * - File size limits by category
 * - Filename sanitization
 * - Extension validation
 */

import { logger } from '../lib/logger'
import { AllowedMimeTypes, FileSizeLimits, type FileCategory } from '../validation/schemas'

const log = logger.child({ module: 'file-validation' })

/**
 * Magic byte signatures for common file types.
 * Format: { mimeType: [signature bytes as hex] }
 */
const MAGIC_SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  // Images
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    // WebP also has "WEBP" at offset 8, but checking RIFF is usually enough
  ],
  
  // Documents
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  
  // MS Office (old format .doc, .xls, .ppt)
  'application/msword': [{ bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }],
  
  // MS Office (new format .docx, .xlsx, .pptx - they're ZIP files)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4B, 0x03, 0x04] }, // PK (ZIP)
  ],
  
  // ZIP
  'application/zip': [
    { bytes: [0x50, 0x4B, 0x03, 0x04] },
    { bytes: [0x50, 0x4B, 0x05, 0x06] }, // Empty archive
    { bytes: [0x50, 0x4B, 0x07, 0x08] }, // Spanned archive
  ],
}

/**
 * Map of extensions to expected MIME types
 */
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.zip': ['application/zip'],
}

export interface FileValidationResult {
  valid: boolean
  detectedMimeType: string | null
  errors: string[]
}

/**
 * Detect MIME type from file buffer using magic bytes
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const [mimeType, signatures] of Object.entries(MAGIC_SIGNATURES)) {
    for (const sig of signatures) {
      const offset = sig.offset || 0
      if (buffer.length < offset + sig.bytes.length) continue
      
      let match = true
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[offset + i] !== sig.bytes[i]) {
          match = false
          break
        }
      }
      
      if (match) return mimeType
    }
  }
  
  return null
}

/**
 * Validate file extension matches expected MIME type
 */
export function validateExtension(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!ext) return false
  
  const expectedMimes = EXTENSION_MIME_MAP[ext]
  if (!expectedMimes) return false
  
  return expectedMimes.includes(mimeType)
}

/**
 * Sanitize filename to prevent path traversal and special chars
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let safe = filename.replace(/^.*[\\/]/, '')
  
  // Remove dangerous characters
  safe = safe.replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
  
  // Remove leading dots (hidden files on Unix)
  safe = safe.replace(/^\.+/, '')
  
  // Limit length
  if (safe.length > 200) {
    const ext = safe.match(/\.[^.]+$/)?.[0] || ''
    safe = safe.slice(0, 200 - ext.length) + ext
  }
  
  // Fallback if empty
  if (!safe) safe = 'unnamed_file'
  
  return safe
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType: string,
  category: FileCategory
): FileValidationResult {
  const errors: string[] = []
  
  // 1. Check file size limit
  const sizeLimit = FileSizeLimits[category] ?? FileSizeLimits['other'] ?? 10 * 1024 * 1024
  if (buffer.length > sizeLimit) {
    errors.push(`File size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(sizeLimit / 1024 / 1024).toFixed(0)}MB`)
  }
  
  // 2. Detect actual MIME type from magic bytes
  const detectedMimeType = detectMimeType(buffer)
  
  // 3. Check if MIME type is allowed for this category
  const allowedMimes = AllowedMimeTypes[category] ?? AllowedMimeTypes['other'] ?? ['application/pdf']
  
  if (detectedMimeType) {
    if (!allowedMimes.includes(detectedMimeType)) {
      errors.push(`File type ${detectedMimeType} is not allowed for category ${category}`)
    }
    
    // 4. Check if declared MIME matches detected (warning, not error)
    if (declaredMimeType !== detectedMimeType) {
      // For DOCX files (ZIP-based), be lenient
      if (!(detectedMimeType === 'application/zip' && declaredMimeType.includes('openxmlformats'))) {
        log.warn('MIME type mismatch', {
          declared: declaredMimeType,
          detected: detectedMimeType,
          filename: originalFilename,
        })
      }
    }
  } else {
    // Could not detect MIME type - fall back to declared but be cautious
    if (!allowedMimes.includes(declaredMimeType)) {
      errors.push(`File type ${declaredMimeType} is not allowed for category ${category}`)
    }
    log.warn('Could not detect MIME type from magic bytes', {
      declared: declaredMimeType,
      filename: originalFilename,
    })
  }
  
  // 5. Validate extension matches (for detected or declared type)
  const effectiveMime = detectedMimeType || declaredMimeType
  if (!validateExtension(originalFilename, effectiveMime)) {
    // Allow ZIP-based Office docs
    const ext = originalFilename.toLowerCase().match(/\.[^.]+$/)?.[0]
    if (!(ext === '.docx' && effectiveMime === 'application/zip')) {
      errors.push(`File extension does not match content type`)
    }
  }
  
  return {
    valid: errors.length === 0,
    detectedMimeType,
    errors,
  }
}

/**
 * Check if file might be malicious based on content patterns
 */
export function scanForMaliciousContent(buffer: Buffer): { safe: boolean; warnings: string[] } {
  const warnings: string[] = []
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000))
  
  // Check for script tags in supposedly non-script files
  if (/<script/i.test(content)) {
    warnings.push('Contains script tags')
  }
  
  // Check for PHP tags
  if (/<\?php/i.test(content)) {
    warnings.push('Contains PHP code')
  }
  
  // Check for shell commands
  if (/^#!\/bin\/(ba)?sh/m.test(content)) {
    warnings.push('Contains shell script')
  }
  
  // Check for executable headers (PE, ELF)
  if (buffer.length >= 2) {
    // MZ header (Windows PE)
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
      warnings.push('Contains Windows executable signature')
    }
    // ELF header (Linux)
    if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      warnings.push('Contains Linux executable signature')
    }
  }
  
  if (warnings.length > 0) {
    log.warn('Potentially malicious file content detected', { warnings })
  }
  
  return {
    safe: warnings.length === 0,
    warnings,
  }
}

/**
 * Generate a secure random filename while preserving extension
 */
export function generateSecureFilename(originalFilename: string): string {
  const ext = originalFilename.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 10)
  return `${timestamp}-${random}${ext}`
}
