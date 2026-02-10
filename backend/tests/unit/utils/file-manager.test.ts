import { describe, test, expect, beforeEach } from 'bun:test'
import '../../setup'
import { FileManager } from '../../../src/utils/file-manager'

describe('FileManager', () => {
  let fm: FileManager

  beforeEach(() => {
    fm = new FileManager({
      storagePath: '/tmp/inmobiliaria-test-storage',
      secretKey: 'test-secret',
      categories: {
        images: { maxSize: 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png'] },
        documents: { maxSize: 5 * 1024 * 1024, allowedTypes: ['application/pdf'] },
      },
    })
  })

  describe('upload', () => {
    test('should upload a valid file', async () => {
      const file = new File(['fake image data'], 'test.jpg', { type: 'image/jpeg' })
      const result = await fm.upload(file, 'images')

      expect(result.filename).toMatch(/^\d+-[\w-]+\.jpg$/)
      expect(result.filepath).toStartWith('images/')
    })

    test('should reject file exceeding max size', async () => {
      const bigContent = new Uint8Array(2 * 1024 * 1024) // 2MB > 1MB limit
      const file = new File([bigContent], 'big.jpg', { type: 'image/jpeg' })

      expect(fm.upload(file, 'images')).rejects.toThrow('File too large')
    })

    test('should reject invalid mime type', async () => {
      const file = new File(['data'], 'test.exe', { type: 'application/x-msdownload' })
      expect(fm.upload(file, 'images')).rejects.toThrow('Invalid file type')
    })

    test('should reject unknown category', async () => {
      const file = new File(['data'], 'test.txt', { type: 'text/plain' })
      expect(fm.upload(file, 'unknown' as any)).rejects.toThrow('Unknown category')
    })
  })

  describe('generateSecureToken / verifyFileToken', () => {
    test('should generate and verify a file token', () => {
      const token = fm.generateSecureToken(42)
      const result = fm.verifyFileToken(token)
      expect(result).not.toBeNull()
      expect(result!.fileId).toBe(42)
    })

    test('should return null for invalid token', () => {
      expect(fm.verifyFileToken('garbage')).toBeNull()
    })

    test('should return null for expired token', () => {
      const token = fm.generateSecureToken(1, '-1s')
      expect(fm.verifyFileToken(token)).toBeNull()
    })
  })
})
