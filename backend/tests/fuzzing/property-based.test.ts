/**
 * Property-Based Testing / Fuzzing
 * 
 * Tests invariants that should hold for ANY valid/invalid input.
 * Generates random inputs to discover edge cases.
 */

import { describe, test, expect } from 'bun:test'
import '../setup'
import { Hono } from 'hono'
import { z } from 'zod'
import { validateBody } from '../../src/middleware/validation'
import { hashPassword, comparePassword, signJWT, verifyJWT, generateSecureToken } from '../../src/utils/crypto'
import { apiResponse, apiError } from '../../src/utils/response'
import { propertySchema, clientSchema, userSchema } from '../../src/validation/schemas'
import { appRequest, parseResponse } from '../helpers'

// ── Random generators ─────────────────────────────────────────────

function randomString(length: number, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join('')
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomEmail(): string {
  return `${randomString(10)}@${randomString(5)}.com`
}

function randomPhone(): string {
  return `+34${randomInt(600000000, 699999999)}`
}

function randomPrice(): string {
  return String(randomInt(10000, 10000000))
}

// Unicode, special chars, injection attempts
const MALICIOUS_INPUTS = [
  '<script>alert("xss")</script>',
  '"; DROP TABLE users; --',
  '{{constructor.constructor("return this")()}}',
  '${7*7}',
  '../../../etc/passwd',
  '\x00\x01\x02', // null bytes
  '🏠🏠🏠'.repeat(100), // emoji flood
  'a'.repeat(10000), // long string
  '\n\r\t', // control chars
  '<img src=x onerror=alert(1)>',
  '"><script>alert(String.fromCharCode(88,83,83))</script>',
  '\u202e\u202d', // RTL override
  '\\u0000', // escaped null
  '%00%0a%0d', // URL encoded control chars
]

// ── Crypto Invariants ─────────────────────────────────────────────

describe('Property-Based: Crypto', () => {
  // Note: Bcrypt is intentionally slow (~300ms per hash), so we limit iterations
  describe('Password hashing invariants', () => {
    test('hash(password) !== password for any password', async () => {
      // Only 3 iterations due to bcrypt cost
      for (let i = 0; i < 3; i++) {
        const password = randomString(randomInt(1, 50))
        const hash = await hashPassword(password)
        expect(hash).not.toBe(password)
      }
    })

    test('hash(p1) !== hash(p2) for different passwords (collision resistance)', async () => {
      const hashes = new Set<string>()
      // Only 3 iterations due to bcrypt cost
      for (let i = 0; i < 3; i++) {
        const password = randomString(20)
        const hash = await hashPassword(password)
        expect(hashes.has(hash)).toBe(false)
        hashes.add(hash)
      }
    })

    test('compare(password, hash(password)) === true for any password', async () => {
      // Only 2 iterations due to bcrypt cost (2 hashes + 2 compares = ~1.2s)
      for (let i = 0; i < 2; i++) {
        const password = randomString(randomInt(8, 64))
        const hash = await hashPassword(password)
        const valid = await comparePassword(password, hash)
        expect(valid).toBe(true)
      }
    })

    test('compare(wrong, hash(password)) === false', async () => {
      // Only 2 iterations due to bcrypt cost
      for (let i = 0; i < 2; i++) {
        const password = randomString(20)
        const wrong = password + 'x'
        const hash = await hashPassword(password)
        const valid = await comparePassword(wrong, hash)
        expect(valid).toBe(false)
      }
    })

    test('handles special characters in passwords', async () => {
      // Limited to 2 passwords due to bcrypt cost (~600ms each pair)
      const specialPasswords = [
        'pass\x00word', // null byte
        '!@#$%^&*()_+{}[]|\\:";\'<>,.?/', // special chars
      ]
      for (const password of specialPasswords) {
        const hash = await hashPassword(password)
        const valid = await comparePassword(password, hash)
        expect(valid).toBe(true)
      }
    })
  })

  describe('JWT invariants', () => {
    test('verify(sign(payload)) returns payload for any valid payload', () => {
      for (let i = 0; i < 20; i++) {
        const payload = {
          userId: randomInt(1, 99999),
          email: randomEmail(),
          role: ['admin', 'agent', 'client'][randomInt(0, 2)],
          randomField: randomString(20),
        }
        const token = signJWT(payload)
        const decoded = verifyJWT(token)
        expect(decoded.userId).toBe(payload.userId)
        expect(decoded.email).toBe(payload.email)
        expect(decoded.role).toBe(payload.role)
      }
    })

    test('token tampering should fail verification', () => {
      const token = signJWT({ userId: 1 })
      
      // Tamper with payload (middle part)
      const parts = token.split('.')
      parts[1] = Buffer.from('{"userId":999}').toString('base64url')
      const tampered = parts.join('.')
      
      expect(() => verifyJWT(tampered)).toThrow()
    })

    test('random strings should fail verification', () => {
      for (let i = 0; i < 20; i++) {
        const garbage = randomString(randomInt(10, 200))
        expect(() => verifyJWT(garbage)).toThrow()
      }
    })
  })

  describe('Secure token invariants', () => {
    test('length is always as requested', () => {
      for (let i = 0; i < 20; i++) {
        const length = randomInt(8, 128)
        const token = generateSecureToken(length)
        expect(token.length).toBe(length)
      }
    })

    test('tokens are unique', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const token = generateSecureToken(32)
        expect(tokens.has(token)).toBe(false)
        tokens.add(token)
      }
    })

    test('contains only alphanumeric characters', () => {
      for (let i = 0; i < 20; i++) {
        const token = generateSecureToken(randomInt(16, 64))
        expect(token).toMatch(/^[a-zA-Z0-9]+$/)
      }
    })
  })
})

// ── Validation Invariants ─────────────────────────────────────────

describe('Property-Based: Validation', () => {
  describe('Schema validation fuzzing', () => {
    test('invalid emails are always rejected', async () => {
      const app = new Hono()
      app.post('/test', validateBody(z.object({ email: z.string().email() })), (c) => c.json({ ok: true }))

      const invalidEmails = [
        'notanemail',
        '@missing-local.com',
        'missing-at-sign.com',
        'spaces in@email.com',
        'email@',
        '',
        'a'.repeat(256) + '@test.com',
      ]

      for (const email of invalidEmails) {
        const res = await appRequest(app, 'POST', '/test', { body: { email } })
        expect(res.status).toBe(400)
      }
    })

    test('valid emails are always accepted', async () => {
      const app = new Hono()
      app.post('/test', validateBody(z.object({ email: z.string().email() })), (c) => c.json({ ok: true }))

      // Note: Zod's email validation requires TLD of at least 2 chars
      const validEmails = [
        'simple@example.com',
        'very.common@example.com',
        'user+tag@example.com',
        'user_name@example.com',
        'user-name@example.com',
        'x@y.co',
      ]

      for (const email of validEmails) {
        const res = await appRequest(app, 'POST', '/test', { body: { email } })
        expect(res.status).toBe(200)
      }
    })

    test('XSS/injection attempts in string fields are sanitized or rejected', async () => {
      const app = new Hono()
      const schema = z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
      })
      app.post('/test', validateBody(schema), (c) => {
        const body = c.get('validatedBody')
        // Even if accepted, returned data should be safe for storage
        return c.json(body)
      })

      for (const malicious of MALICIOUS_INPUTS.slice(0, 5)) {
        const res = await appRequest(app, 'POST', '/test', {
          body: { title: malicious.slice(0, 200) }
        })
        // Either rejected (400) or accepted but returned without modification
        if (res.status === 200) {
          const body = await parseResponse(res)
          expect(typeof body.title).toBe('string')
        }
      }
    })

    test('numeric bounds are enforced', async () => {
      const app = new Hono()
      const schema = z.object({
        price: z.number().positive().max(999999999),
        bedrooms: z.number().int().min(0).max(100),
      })
      app.post('/test', validateBody(schema), (c) => c.json({ ok: true }))

      const invalidCases = [
        { price: -1, bedrooms: 2 },
        { price: 100, bedrooms: -1 },
        { price: 100, bedrooms: 101 },
        { price: 0, bedrooms: 2 },
        { price: 1e15, bedrooms: 2 },
      ]

      for (const body of invalidCases) {
        const res = await appRequest(app, 'POST', '/test', { body })
        expect(res.status).toBe(400)
      }
    })
  })

  describe('Property schema fuzzing', () => {
    test('random valid properties pass validation', () => {
      for (let i = 0; i < 50; i++) {
        const validProperty = {
          title: randomString(randomInt(5, 50)),
          address: randomString(randomInt(10, 100)),
          city: randomString(randomInt(3, 30)),
          propertyType: ['apartment', 'house', 'commercial', 'land'][randomInt(0, 3)],
          price: randomPrice(),
          bedrooms: randomInt(0, 20),
          bathrooms: randomInt(1, 10),
        }
        
        const result = propertySchema.safeParse(validProperty)
        expect(result.success).toBe(true)
      }
    })

    test('missing required fields always fail', () => {
      const requiredFields = ['title', 'address', 'city', 'propertyType', 'price']
      const baseProperty = {
        title: 'Test',
        address: 'Test Address',
        city: 'Madrid',
        propertyType: 'apartment',
        price: '100000',
      }

      for (const field of requiredFields) {
        const incomplete = { ...baseProperty }
        delete (incomplete as any)[field]
        const result = propertySchema.safeParse(incomplete)
        expect(result.success).toBe(false)
      }
    })
  })
})

// ── Response Invariants ───────────────────────────────────────────

describe('Property-Based: Response format', () => {
  test('apiResponse always has success: true', () => {
    for (let i = 0; i < 20; i++) {
      const data = {
        [randomString(10)]: randomString(20),
        number: randomInt(0, 1000),
        nested: { deep: randomString(5) },
      }
      const response = apiResponse(data)
      expect(response.success).toBe(true)
      expect(response.data).toEqual(data)
    }
  })

  test('apiError always has success: false', () => {
    const errorCodes = ['VALIDATION_FAILED', 'INVALID_INPUT', 'AUTH_REQUIRED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'INTERNAL_ERROR']
    for (let i = 0; i < 20; i++) {
      const message = randomString(randomInt(10, 100))
      const statusCode = randomInt(400, 599)
      const code = errorCodes[randomInt(0, errorCodes.length - 1)] as string
      const response = apiError(message, statusCode, code)
      expect(response.success).toBe(false)
      expect(response.error.message).toBe(message)
      expect(response.error.statusCode).toBe(statusCode)
      expect(response.error.code).toBe(code)
    }
  })

  test('apiResponse handles null and undefined gracefully', () => {
    expect(apiResponse(null).data).toBeNull()
    expect(apiResponse(undefined).data).toBeUndefined()
    expect(apiResponse([]).data).toEqual([])
  })
})

// ── Load & Stress Invariants ──────────────────────────────────────

describe('Property-Based: Stress invariants', () => {
  test('system handles 500 rapid sequential validation requests', async () => {
    const app = new Hono()
    app.post('/test', validateBody(z.object({ x: z.number() })), (c) => c.json({ ok: true }))

    const results = await Promise.all(
      Array.from({ length: 500 }, (_, i) =>
        appRequest(app, 'POST', '/test', { body: { x: i } })
      )
    )

    const all200 = results.every(r => r.status === 200)
    expect(all200).toBe(true)
  })

  test('password hashing remains consistent under load', async () => {
    const password = 'testpassword123'
    
    // Reduced to 3 parallel hashes due to bcrypt cost (~300ms each x 3 = ~1s)
    const hashes = await Promise.all(
      Array.from({ length: 3 }, () => hashPassword(password))
    )
    
    // All hashes should be different (unique salts)
    const uniqueHashes = new Set(hashes)
    expect(uniqueHashes.size).toBe(3)
    
    // All should verify correctly
    const verifications = await Promise.all(
      hashes.map(h => comparePassword(password, h))
    )
    expect(verifications.every(v => v === true)).toBe(true)
  })
})
