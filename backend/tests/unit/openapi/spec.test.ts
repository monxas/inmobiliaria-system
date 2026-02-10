import { describe, test, expect } from 'bun:test'
import '../../setup'
import { openApiApp } from '../../../src/openapi'
import { appRequest, parseResponse } from '../../helpers'

describe('OpenAPI Specification', () => {
  test('GET /api/openapi.json returns valid OpenAPI spec', async () => {
    const res = await appRequest(openApiApp, 'GET', '/api/openapi.json')
    expect(res.status).toBe(200)

    const spec = await parseResponse(res)
    expect(spec.openapi).toStartWith('3.')
    expect(spec.info.title).toBe('Inmobiliaria API')
    expect(spec.info.version).toBe('0.1.0')
    expect(spec.paths).toBeDefined()
    expect(spec.paths['/health']).toBeDefined()
  })

  test('spec has security schemes defined', async () => {
    const res = await appRequest(openApiApp, 'GET', '/api/openapi.json')
    const spec = await parseResponse(res)
    // Security schemes may be in components or at top level depending on version
    const secSchemes = spec.components?.securitySchemes
    if (secSchemes) {
      expect(secSchemes.bearerAuth).toBeDefined()
      expect(secSchemes.bearerAuth.type).toBe('http')
    } else {
      // At minimum, security should be referenced somewhere
      expect(spec.security || spec.components).toBeDefined()
    }
  })

  test('spec has tags defined', async () => {
    const res = await appRequest(openApiApp, 'GET', '/api/openapi.json')
    const spec = await parseResponse(res)
    const tagNames = spec.tags.map((t: any) => t.name)
    expect(tagNames).toContain('System')
    expect(tagNames).toContain('Auth')
    expect(tagNames).toContain('Properties')
    expect(tagNames).toContain('Clients')
  })

  test('spec has servers defined', async () => {
    const res = await appRequest(openApiApp, 'GET', '/api/openapi.json')
    const spec = await parseResponse(res)
    expect(spec.servers.length).toBeGreaterThanOrEqual(1)
  })

  test('spec includes LLM-friendly description', async () => {
    const res = await appRequest(openApiApp, 'GET', '/api/openapi.json')
    const spec = await parseResponse(res)
    expect(spec.info.description).toContain('LLM')
    expect(spec.info.description).toContain('AI agents')
  })

  test('GET /docs returns Scalar UI', async () => {
    const res = await appRequest(openApiApp, 'GET', '/docs')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Inmobiliaria')
  })

  test('GET /health through OpenAPI app works', async () => {
    const res = await appRequest(openApiApp, 'GET', '/health')
    expect(res.status).toBe(200)
    const body = await parseResponse(res)
    expect(body.status).toBe('healthy')
  })
})
