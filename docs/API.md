# Inmobiliaria System - API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Roles
- `admin` - Full access to all resources
- `agent` - Can manage properties, clients, documents
- `client` - Limited access (view properties, own profile)

---

## Auth Endpoints

### POST /api/auth/register
Register a new user (always creates `client` role).

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123",
    "fullName": "John Doe",
    "phone": "+34600123456"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "role": "client",
    "fullName": "John Doe",
    "phone": "+34600123456",
    "createdAt": "2026-02-10T22:00:00.000Z"
  }
}
```

### POST /api/auth/login
Authenticate and get JWT token.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "role": "client",
      "fullName": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### GET /api/auth/me
Get current user profile (requires auth).

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### PUT /api/auth/me
Update current user profile (requires auth).

```bash
curl -X PUT http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Updated",
    "phone": "+34600999888"
  }'
```

---

## Properties Endpoints

### GET /api/properties
List properties with optional filters (public).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | int | Page number (default: 1) |
| limit | int | Items per page (max: 100, default: 10) |
| city | string | Filter by city (partial match) |
| propertyType | enum | `house`, `apartment`, `office`, `warehouse`, `land`, `commercial` |
| status | enum | `available`, `reserved`, `sold`, `rented`, `off_market` |
| minPrice | string | Minimum price |
| maxPrice | string | Maximum price |
| minBedrooms | int | Minimum bedrooms |
| minSurface | int | Minimum surface area (m²) |
| ownerId | int | Filter by owner ID |
| agentId | int | Filter by agent ID |

```bash
# All available properties in Madrid
curl "http://localhost:3000/api/properties?city=Madrid&status=available"

# Houses with 3+ bedrooms, under 500k
curl "http://localhost:3000/api/properties?propertyType=house&minBedrooms=3&maxPrice=500000"

# Paginated results
curl "http://localhost:3000/api/properties?page=2&limit=20"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Luxury Apartment in Madrid",
      "description": "Beautiful apartment...",
      "address": "Calle Gran Vía 50",
      "city": "Madrid",
      "postalCode": "28013",
      "country": "España",
      "propertyType": "apartment",
      "status": "available",
      "price": "350000.00",
      "surfaceArea": 120,
      "bedrooms": 3,
      "bathrooms": 2,
      "garage": true,
      "garden": false,
      "ownerId": 1,
      "agentId": 2,
      "createdAt": "2026-02-10T10:00:00.000Z",
      "updatedAt": "2026-02-10T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    }
  }
}
```

### GET /api/properties/:id
Get a single property by ID (public).

```bash
curl http://localhost:3000/api/properties/1
```

### POST /api/properties
Create a new property (requires: `agent` or `admin`).

```bash
curl -X POST http://localhost:3000/api/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Modern Villa in Barcelona",
    "description": "Stunning villa with sea views",
    "address": "Carrer de Pau Claris 100",
    "city": "Barcelona",
    "postalCode": "08009",
    "propertyType": "house",
    "status": "available",
    "price": "850000",
    "surfaceArea": 250,
    "bedrooms": 5,
    "bathrooms": 3,
    "garage": true,
    "garden": true
  }'
```

### PUT /api/properties/:id
Update a property (requires: `agent` or `admin`).

```bash
curl -X PUT http://localhost:3000/api/properties/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "reserved",
    "price": "840000"
  }'
```

### DELETE /api/properties/:id
Soft delete a property (requires: `agent` or `admin`).

```bash
curl -X DELETE http://localhost:3000/api/properties/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Clients Endpoints

All client endpoints require authentication with `agent` or `admin` role.

### GET /api/clients
List clients with optional filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | int | Page number |
| limit | int | Items per page |
| fullName | string | Filter by name (partial match) |
| email | string | Filter by email (partial match) |
| agentId | int | Filter by assigned agent |

```bash
curl "http://localhost:3000/api/clients?fullName=García" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/clients/:id
Get a single client.

```bash
curl http://localhost:3000/api/clients/1 \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/clients
Create a new client.

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "María García",
    "email": "maria@example.com",
    "phone": "+34611222333",
    "address": "Calle Mayor 10, Madrid",
    "notes": "Interested in properties near the center",
    "agentId": 2
  }'
```

### PUT /api/clients/:id
Update a client.

```bash
curl -X PUT http://localhost:3000/api/clients/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Now looking for larger properties"
  }'
```

### DELETE /api/clients/:id
Soft delete a client.

```bash
curl -X DELETE http://localhost:3000/api/clients/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Users Endpoints

All user management endpoints require `admin` role.

### GET /api/users
List all users.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | int | Page number |
| limit | int | Items per page |
| email | string | Filter by email |
| role | enum | `admin`, `agent`, `client` |
| fullName | string | Filter by name |

```bash
curl "http://localhost:3000/api/users?role=agent" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### GET /api/users/:id
Get a single user.

```bash
curl http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### POST /api/users
Create a new user (can set any role).

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newagent@company.com",
    "password": "securepass123",
    "role": "agent",
    "fullName": "New Agent",
    "phone": "+34600111222"
  }'
```

### PUT /api/users/:id
Update a user (including role changes).

```bash
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

### DELETE /api/users/:id
Soft delete a user.

```bash
curl -X DELETE http://localhost:3000/api/users/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Documents Endpoints

### GET /api/documents/download/:token
Download a document using access token (public).

```bash
curl -OJ http://localhost:3000/api/documents/download/abc123token
```

### GET /api/documents
List documents (requires: `agent` or `admin`).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | int | Page number |
| limit | int | Items per page |
| category | enum | `property_docs`, `property_images`, `client_docs`, `contracts`, `other` |
| propertyId | int | Filter by property |
| clientId | int | Filter by client |
| isPublic | bool | Filter by public status |
| uploadedBy | int | Filter by uploader |

```bash
curl "http://localhost:3000/api/documents?category=contracts&propertyId=1" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/documents/:id
Get document metadata.

```bash
curl http://localhost:3000/api/documents/1 \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/documents/upload
Upload a new document (requires: `agent` or `admin`).

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "category=contracts" \
  -F "propertyId=1"
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "1707602400000-abc123.pdf",
    "originalFilename": "document.pdf",
    "filePath": "/app/uploads/contracts/1707602400000-abc123.pdf",
    "fileSize": 102400,
    "mimeType": "application/pdf",
    "category": "contracts",
    "propertyId": 1,
    "accessToken": "xYz123TokenForDownload",
    "downloadCount": 0,
    "isPublic": false,
    "uploadedBy": 2,
    "createdAt": "2026-02-10T22:00:00.000Z"
  }
}
```

### PUT /api/documents/:id
Update document metadata.

```bash
curl -X PUT http://localhost:3000/api/documents/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "property_docs",
    "isPublic": true
  }'
```

### DELETE /api/documents/:id
Soft delete a document.

```bash
curl -X DELETE http://localhost:3000/api/documents/1 \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/documents/:id/regenerate-token
Generate a new access token (invalidates old one).

```bash
curl -X POST http://localhost:3000/api/documents/1/regenerate-token \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "code": 404,
    "details": null
  }
}
```

### Common HTTP Status Codes
| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate entry (e.g., email) |
| 500 | Internal Server Error |

---

## Health Check

### GET /health
Basic health check.

```bash
curl http://localhost:3000/health
```

### GET /health/detailed
Detailed health check with database status.

```bash
curl http://localhost:3000/health/detailed
```

---

## Quick Start Example

```bash
# 1. Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.com","password":"demo12345","fullName":"Demo User"}'

# 2. Login and save token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.com","password":"demo12345"}' | jq -r '.data.token')

# 3. View properties (public)
curl http://localhost:3000/api/properties

# 4. Access protected route
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```
