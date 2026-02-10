import { describe, test, expect } from 'bun:test'
import '../../setup'
import {
  hashPassword,
  comparePassword,
  signJWT,
  verifyJWT,
  generateSecureToken,
} from '../../../src/utils/crypto'

describe('crypto utils', () => {
  describe('hashPassword / comparePassword', () => {
    test('should hash and verify a password', async () => {
      const password = 'SuperSecret123!'
      const hash = await hashPassword(password)

      expect(hash).not.toBe(password)
      expect(hash).toStartWith('$2a$')
      expect(await comparePassword(password, hash)).toBe(true)
    })

    test('should reject wrong password', async () => {
      const hash = await hashPassword('correct')
      expect(await comparePassword('wrong', hash)).toBe(false)
    })

    test('should produce different hashes for same password', async () => {
      const h1 = await hashPassword('same')
      const h2 = await hashPassword('same')
      expect(h1).not.toBe(h2) // different salts
    })
  })

  describe('signJWT / verifyJWT', () => {
    test('should sign and verify a token', () => {
      const payload = { userId: 1, role: 'admin' }
      const token = signJWT(payload)

      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)

      const decoded = verifyJWT<typeof payload>(token)
      expect(decoded.userId).toBe(1)
      expect(decoded.role).toBe('admin')
    })

    test('should throw on invalid token', () => {
      expect(() => verifyJWT('invalid.token.here')).toThrow()
    })

    test('should throw on tampered token', () => {
      const token = signJWT({ test: true })
      const tampered = token.slice(0, -5) + 'XXXXX'
      expect(() => verifyJWT(tampered)).toThrow()
    })

    test('should respect expiration', () => {
      const token = signJWT({ test: true }, '0s') // expires immediately
      // Small race: might or might not throw depending on timing
      // Use a clearly expired approach instead
      const expired = signJWT({ test: true }, '-1s')
      expect(() => verifyJWT(expired)).toThrow()
    })
  })

  describe('generateSecureToken', () => {
    test('should generate token of specified length', () => {
      expect(generateSecureToken(16)).toHaveLength(16)
      expect(generateSecureToken(64)).toHaveLength(64)
      expect(generateSecureToken()).toHaveLength(32)
    })

    test('should only contain alphanumeric characters', () => {
      const token = generateSecureToken(100)
      expect(token).toMatch(/^[A-Za-z0-9]+$/)
    })

    test('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()))
      expect(tokens.size).toBe(100)
    })
  })
})
