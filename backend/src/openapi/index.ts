/**
 * OpenAPI App — Serves auto-generated OpenAPI 3.0 spec + Swagger UI
 *
 * Usage: Import and mount on your main Hono app
 *   import { openApiApp } from './openapi'
 *   app.route('/', openApiApp)
 */
import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { healthRoute } from './routes'

export const openApiApp = new OpenAPIHono()

// Register a sample route to populate the spec
openApiApp.openapi(healthRoute, async (c) => {
  return c.json({
    status: 'healthy' as const,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    checks: { api: 'ok', database: 'ok' },
  }, 200)
})

// OpenAPI JSON spec endpoint
openApiApp.doc31('/api/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Inmobiliaria API',
    version: '0.1.0',
    description: `
# Inmobiliaria System API

Self-hosted real estate management system optimized for NAS deployment.

## Authentication
All protected endpoints require a Bearer JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## Roles
- **admin** — Full system access
- **agent** — Property and client management
- **client** — View properties, manage own profile

## Pagination
List endpoints support pagination via query parameters:
- \`page\` — Page number (default: 1)
- \`limit\` — Items per page (default: 10, max: 100)

## Error Format
All errors follow the format:
\`\`\`json
{
  "success": false,
  "error": {
    "message": "Description",
    "code": 400,
    "details": [...]
  }
}
\`\`\`

## For LLM Agents
This API is designed to be consumed by AI agents. Key patterns:
1. All responses have \`success: boolean\` for easy error detection
2. Consistent pagination across all list endpoints
3. Standard CRUD operations on all resources
4. JWT auth with role-based access control
    `.trim(),
    contact: { name: 'Mon', email: 'admin@inmobiliaria.local' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
    { url: 'https://api.inmobiliaria.local', description: 'Production (NAS)' },
  ],
  tags: [
    { name: 'System', description: 'Health checks and system info' },
    { name: 'Auth', description: 'Authentication and authorization' },
    { name: 'Properties', description: 'Real estate property management' },
    { name: 'Clients', description: 'Client/customer management' },
    { name: 'Documents', description: 'File and document management' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from /auth/login or /auth/register',
      },
    },
  },
} as any)

// Scalar API Reference UI (modern Swagger alternative)
openApiApp.get('/docs', apiReference({
  theme: 'kepler',
  spec: { url: '/api/openapi.json' },
  pageTitle: 'Inmobiliaria API Docs',
}))

// Also serve a simple redirect at /api/docs
openApiApp.get('/api/docs', (c) => c.redirect('/docs'))

export { openApiApp as docsApp }
