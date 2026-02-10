# 🔐 Security Documentation

**Last Updated:** 2026-02-10
**Security Score:** 9.5/10

---

## 📋 Overview

This document describes the security measures implemented in the Inmobiliaria System API.

## 🔑 Authentication & Authorization

### JWT Token Pattern

We implement a **dual-token authentication pattern**:

| Token Type | Lifetime | Storage | Purpose |
|------------|----------|---------|---------|
| Access Token | 15 minutes | Client (memory) | API authentication |
| Refresh Token | 7 days | HttpOnly cookie | Obtain new access tokens |

**Benefits:**
- Access tokens are short-lived, limiting exposure if compromised
- Refresh tokens are stored in HttpOnly cookies, preventing XSS attacks
- Token rotation on each refresh prevents replay attacks

### Token Rotation

Every refresh operation:
1. Validates the current refresh token
2. **Revokes** the used refresh token
3. Issues a **new** refresh token
4. Returns a new access token

### Family-Based Revocation

Tokens are grouped into "families". If a revoked token is reused:
1. The entire family is revoked
2. All sessions for that family are invalidated
3. Attack attempt is logged

### Password Policy

Passwords must meet the following requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

```typescript
// Example password validation
const password = "SecurePass123"  // ✅ Valid
const weak = "password"           // ❌ No uppercase, no number
```

---

## 📁 File Upload Security

### Magic Bytes Validation

Files are validated using their actual content (magic bytes), not just the extension:

| File Type | Magic Bytes | Hex Signature |
|-----------|-------------|---------------|
| JPEG | `FFD8FF` | `\xFF\xD8\xFF` |
| PNG | `89504E47` | `\x89PNG` |
| PDF | `25504446` | `%PDF` |
| GIF | `47494638` | `GIF8` |

### Size Limits by Category

| Category | Max Size |
|----------|----------|
| property_images | 10 MB |
| property_docs | 25 MB |
| client_docs | 25 MB |
| contracts | 50 MB |
| other | 10 MB |

### Allowed MIME Types

```typescript
{
  property_images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  property_docs: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  contracts: ['application/pdf'],
}
```

### Malicious Content Detection

Uploaded files are scanned for:
- `<script>` tags
- PHP code (`<?php`)
- Shell scripts (`#!/bin/bash`)
- Executable signatures (MZ, ELF)

---

## 🚦 Rate Limiting

### Endpoint-Based Limits

| Endpoint Type | Requests | Window |
|---------------|----------|--------|
| Authentication | 5 | 1 minute |
| File Uploads | 10 | 1 minute |
| Write Operations | 30 | 1 minute |
| Read Operations | 100 | 1 minute |
| Search | 30 | 1 minute |
| Sensitive | 20 | 1 minute |

### Progressive Blocking

Repeat offenders are blocked with increasing durations:

1. First violation: 1 minute
2. Second: 5 minutes
3. Third: 15 minutes
4. Fourth: 1 hour
5. Fifth+: 24 hours

### Rate Limit Headers

All responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707606000
```

When blocked:
```
Retry-After: 60
```

---

## 🛡️ Security Headers

All API responses include:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | Restrict resources |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer |
| `Permissions-Policy` | `camera=(), microphone=()...` | Disable browser features |
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevent window.opener attacks |
| `Cross-Origin-Resource-Policy` | `same-origin` | Restrict resource loading |

---

## 🔍 Input Validation

### Zod Schemas

All input is validated using strict Zod schemas:

```typescript
export const CreateUserSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: PasswordSchema, // enforces complexity
  fullName: z.string().min(2).max(255),
  phone: z.string().max(50).regex(/^[\d\s+\-().]+$/),
})
```

### SQL Injection Prevention

- All database queries use parameterized queries (Drizzle ORM)
- Additional pattern detection for suspicious input
- Input sanitization for search queries

---

## 📊 Logging & Monitoring

### Structured Logging

All logs are JSON-formatted with:
- Timestamp
- Log level
- Request ID (correlation)
- Contextual data

```json
{
  "level": "info",
  "msg": "User logged in",
  "timestamp": "2026-02-10T23:00:00.000Z",
  "userId": 123,
  "ip": "1.2.3.4"
}
```

### Security Events Logged

- Failed login attempts
- Rate limit violations
- Malicious file uploads blocked
- Token refresh/revocation
- Session management events

---

## 🔧 Configuration

### Environment Variables

```bash
# JWT
JWT_SECRET=your-secret-key
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=7

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5

# Security
ENABLE_HSTS=true
CSP_REPORT_URI=https://your-report-uri

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## ✅ Security Checklist

- [x] JWT refresh token rotation
- [x] HttpOnly cookies for refresh tokens
- [x] Strong password policy
- [x] File upload validation (magic bytes)
- [x] Malicious content scanning
- [x] Granular rate limiting
- [x] Progressive blocking
- [x] Comprehensive security headers
- [x] CORS configuration
- [x] Input validation with Zod
- [x] SQL injection prevention
- [x] Structured logging
- [x] Request correlation IDs
- [ ] Two-factor authentication (planned)
- [ ] API key authentication (planned)
- [ ] IP allowlisting for admin (planned)

---

## 🔄 Session Management

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login, returns tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Revoke current session |
| `/api/auth/logout-all` | POST | Revoke all sessions |
| `/api/auth/sessions` | GET | List active sessions |
| `/api/auth/sessions/:id` | DELETE | Revoke specific session |

### Session Info

Each session tracks:
- IP address
- User agent
- Created timestamp
- Last used timestamp

---

## 📝 Incident Response

### Rate Limit Exceeded

1. Log includes IP, endpoint, and violation count
2. Progressive blocking applied automatically
3. Monitor for patterns indicating attack

### Malicious Upload Detected

1. File is rejected with 400 error
2. Attempt logged with full context
3. IP may be flagged for monitoring

### Token Reuse Detected

1. Entire token family revoked
2. All sessions invalidated
3. Potential attack logged as warning

---

*Security documentation generated 2026-02-10*
