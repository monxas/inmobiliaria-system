/**
 * @fileoverview Tests for file validation with magic bytes detection.
 */

import { describe, test, expect } from 'bun:test'
import {
  detectMimeType,
  validateFile,
  sanitizeFilename,
  generateSecureFilename,
  scanForMaliciousContent,
  validateExtension,
} from '../../src/utils/file-validation'
import type { FileCategory } from '../../src/validation/schemas'

describe('File Validation', () => {
  describe('detectMimeType', () => {
    test('should detect JPEG files', () => {
      // JPEG magic bytes: FF D8 FF
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
      expect(detectMimeType(jpegBuffer)).toBe('image/jpeg')
    })

    test('should detect PNG files', () => {
      // PNG magic bytes
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00])
      expect(detectMimeType(pngBuffer)).toBe('image/png')
    })

    test('should detect GIF files', () => {
      // GIF89a
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      expect(detectMimeType(gifBuffer)).toBe('image/gif')
    })

    test('should detect PDF files', () => {
      // %PDF
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E])
      expect(detectMimeType(pdfBuffer)).toBe('application/pdf')
    })

    test('should detect ZIP/DOCX files', () => {
      // PK (ZIP header - also used for DOCX)
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00])
      // Should detect as DOCX (which is ZIP-based) - first match in our signatures
      const detected = detectMimeType(zipBuffer)
      expect(detected === 'application/zip' || detected === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').toBe(true)
    })

    test('should return null for unknown files', () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00])
      expect(detectMimeType(unknownBuffer)).toBeNull()
    })

    test('should handle empty buffer', () => {
      expect(detectMimeType(Buffer.alloc(0))).toBeNull()
    })
  })

  describe('validateExtension', () => {
    test('should validate matching extension and MIME', () => {
      expect(validateExtension('photo.jpg', 'image/jpeg')).toBe(true)
      expect(validateExtension('photo.jpeg', 'image/jpeg')).toBe(true)
      expect(validateExtension('image.png', 'image/png')).toBe(true)
      expect(validateExtension('document.pdf', 'application/pdf')).toBe(true)
    })

    test('should reject mismatched extension and MIME', () => {
      expect(validateExtension('photo.jpg', 'image/png')).toBe(false)
      expect(validateExtension('document.pdf', 'image/jpeg')).toBe(false)
    })

    test('should handle unknown extensions', () => {
      expect(validateExtension('file.xyz', 'application/unknown')).toBe(false)
    })
  })

  describe('validateFile', () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, ...Array(1000).fill(0)])
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, ...Array(1000).fill(0)])

    test('should accept valid image for property_images', () => {
      const result = validateFile(jpegBuffer, 'photo.jpg', 'image/jpeg', 'property_images')
      expect(result.valid).toBe(true)
      expect(result.detectedMimeType).toBe('image/jpeg')
      expect(result.errors).toHaveLength(0)
    })

    test('should reject wrong MIME type for category', () => {
      const result = validateFile(pdfBuffer, 'document.pdf', 'application/pdf', 'property_images')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('not allowed'))).toBe(true)
    })

    test('should accept PDF for contracts', () => {
      const result = validateFile(pdfBuffer, 'contract.pdf', 'application/pdf', 'contracts')
      expect(result.valid).toBe(true)
    })

    test('should reject oversized files', () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024) // 60MB
      largeBuffer[0] = 0xFF
      largeBuffer[1] = 0xD8
      largeBuffer[2] = 0xFF

      const result = validateFile(largeBuffer, 'huge.jpg', 'image/jpeg', 'property_images')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('exceeds limit'))).toBe(true)
    })
  })

  describe('sanitizeFilename', () => {
    test('should remove path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd')
      expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('system32')
    })

    test('should remove dangerous characters', () => {
      expect(sanitizeFilename('file<script>.jpg')).toBe('filescript.jpg')
      expect(sanitizeFilename('file|name.pdf')).toBe('filename.pdf')
      expect(sanitizeFilename('file:name.doc')).toBe('filename.doc')
    })

    test('should remove leading dots', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden')
      expect(sanitizeFilename('...hidden')).toBe('hidden')
    })

    test('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.jpg'
      const sanitized = sanitizeFilename(longName)
      expect(sanitized.length).toBeLessThanOrEqual(204) // 200 + .jpg
    })

    test('should return fallback for empty result', () => {
      expect(sanitizeFilename('...')).toBe('unnamed_file')
      expect(sanitizeFilename('')).toBe('unnamed_file')
    })
  })

  describe('generateSecureFilename', () => {
    test('should preserve extension', () => {
      const filename = generateSecureFilename('document.pdf')
      expect(filename).toMatch(/^\d+-[a-z0-9]+\.pdf$/)
    })

    test('should handle no extension', () => {
      const filename = generateSecureFilename('noext')
      expect(filename).toMatch(/^\d+-[a-z0-9]+$/)
    })

    test('should generate unique filenames', () => {
      const name1 = generateSecureFilename('test.jpg')
      const name2 = generateSecureFilename('test.jpg')
      expect(name1).not.toBe(name2)
    })
  })

  describe('scanForMaliciousContent', () => {
    test('should detect script tags', () => {
      const buffer = Buffer.from('<html><script>alert("xss")</script></html>')
      const result = scanForMaliciousContent(buffer)
      expect(result.safe).toBe(false)
      expect(result.warnings).toContain('Contains script tags')
    })

    test('should detect PHP code', () => {
      const buffer = Buffer.from('<?php echo "hello"; ?>')
      const result = scanForMaliciousContent(buffer)
      expect(result.safe).toBe(false)
      expect(result.warnings).toContain('Contains PHP code')
    })

    test('should detect shell scripts', () => {
      const buffer = Buffer.from('#!/bin/bash\nrm -rf /')
      const result = scanForMaliciousContent(buffer)
      expect(result.safe).toBe(false)
      expect(result.warnings).toContain('Contains shell script')
    })

    test('should detect Windows executables', () => {
      const buffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00]) // MZ header
      const result = scanForMaliciousContent(buffer)
      expect(result.safe).toBe(false)
      expect(result.warnings).toContain('Contains Windows executable signature')
    })

    test('should detect Linux executables', () => {
      const buffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46]) // ELF header
      const result = scanForMaliciousContent(buffer)
      expect(result.safe).toBe(false)
      expect(result.warnings).toContain('Contains Linux executable signature')
    })

    test('should pass clean files', () => {
      const buffer = Buffer.from('Hello, this is a normal text file content.')
      const result = scanForMaliciousContent(buffer)
      expect(result.safe).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
