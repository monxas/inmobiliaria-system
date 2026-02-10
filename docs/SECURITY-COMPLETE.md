# 🔐 Security Documentation - Complete

**Last Updated:** 2026-02-10  
**Security Score:** 10/10 ✅  
**Compliance:** GDPR Ready, SOC2 Preparedness

---

## 📋 Executive Summary

The Inmobiliaria System implements enterprise-grade security with:
- **Multi-layer authentication** (JWT with advanced claims, MFA ready)
- **Defense in depth** (rate limiting, account lockout, session management)
- **Data protection** (field-level encryption, masking, GDPR compliance)
- **Comprehensive audit trail** (tamper-evident logging)
- **Security by default** (strict headers, CSP, HSTS)

---

## 🔑 Authentication & Authorization

### JWT Token Security

| Feature | Implementation | Status |
|---------|---------------|--------|
| Token Type Enforcement | `type` claim validation | ✅ |
| Issuer Validation | `iss` claim check | ✅ |
| Audience Validation | `aud` claim check | ✅ |
| JWT ID (jti) | Unique token identifier | ✅ |
| Not Before (nbf) | Token activation time | ✅ |
| Token Rotation | Refresh token rotation | ✅ |
| Family Revocation | Attack detection | ✅ |

#### Token Configuration

```typescript
JWT_CONFIG = {
  issuer: 'inmobiliaria-system',
  audience: 'inmobiliaria-api',
  algorithm: 'HS256',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
}
```

### Account Lockout Policy

Progressive lockout after failed authentication:

| Attempt | Lockout Duration |
|---------|------------------|
| 1st lockout | 5 minutes |
| 2nd lockout | 15 minutes |
| 3rd lockout | 1 hour |
| 4th lockout | 4 hours |
| 5th+ lockout | 24 hours |

Features:
- ✅ IP-based tracking
- ✅ Email-based tracking
- ✅ Credential stuffing detection
- ✅ Admin manual unlock
- ✅ Automatic reset on success

### MFA Infrastructure

TOTP (Authenticator App) support ready:

```typescript
MFA_CONFIG = {
  totp: {
    algorithm: 'sha1',
    digits: 6,
    period: 30,
    window: 1,  // Clock drift tolerance
  },
  recovery: {
    codeCount: 10,
    codeLength: 8,
  },
}
```

Supported methods:
- ✅ TOTP (RFC 6238)
- ✅ Recovery codes
- 🔄 WebAuthn/FIDO2 (infrastructure ready)
- 🔄 SMS (not recommended, available)

### Session Security

| Feature | Configuration |
|---------|--------------|
| Max Concurrent Sessions | 5 per user |
| Idle Timeout | 30 minutes |
| Absolute Timeout | 24 hours |
| Device Fingerprinting | SHA-256 hash |
| IP Change Detection | ✅ Enabled |
| Max IP Changes | 5 before flag |

---

## 🚦 Rate Limiting

### Sliding Window Algorithm

True sliding window implementation (not fixed windows):

| Endpoint Type | Requests/min | Burst | Cost |
|---------------|-------------|-------|------|
| Auth | 5 | - | 1 |
| Upload | 10 | - | 5 |
| Write | 30 | - | 2 |
| Read | 100 | 20 | 1 |
| Search | 30 | - | 2 |
| Admin | 20 | - | 3 |
| Export | 5/5min | - | 10 |

Features:
- ✅ Per-user limits
- ✅ Per-IP limits
- ✅ Cost-based (some operations cost more)
- ✅ Burst allowance
- ✅ Progressive penalties
- ✅ Distributed-ready (Redis interface)

### Progressive Blocking

Repeat violators face escalating penalties:
1. First violation: Normal window reset
2. Second violation: 2x window duration
3. Third+ violation: Up to 5x window duration

---

## 🔒 Data Security

### Field-Level Encryption

PII fields encrypted at rest using AES-256-GCM:

**Automatically Encrypted Fields:**
- email, phone, dni, nie, passport
- address, fullName
- bankAccount, iban
- taxId, socialSecurity
- dateOfBirth, nationalId

**Format:** `v1:{iv}:{authTag}:{ciphertext}`

```typescript
// Automatic encryption
const encrypted = encryptPII({ email: 'user@example.com' })
// { email: 'v1:abc123...:def456...:ghi789...' }

// Searchable hash for lookups
const hash = createSearchableHash('user@example.com', 'email')
// 'sh:abc123def456...'
```

### Data Masking

Automatic masking in logs and responses:

| Field Type | Masking |
|------------|---------|
| Password/Secret | `********` |
| Email | `u***r@***.com` |
| Phone | `+34***456` |
| IBAN | `ES12***5678` |
| DNI | `12***89A` |
| JWT | `[JWT_TOKEN]` |

### Audit Trail

Tamper-evident logging with hash chain:

```typescript
AuditEntry = {
  id: 'audit_xxx',
  timestamp: 'ISO',
  action: 'data.update',
  severity: 'info',
  context: {
    userId, userEmail, ipAddress, requestId
  },
  data: {
    entityType: 'property',
    entityId: 123,
    before: {...},
    after: {...},
    changes: { field: { old, new } }
  },
  hash: 'sha256...',     // For tamper detection
  previousHash: '...',    // Chain to previous
}
```

**Logged Events:**
- All CRUD operations
- Authentication events
- Security events (lockouts, rate limits)
- Admin operations
- Data exports

---

## 🔐 Request Signing (HMAC)

Critical endpoints support HMAC-SHA256 signing:

### Request Headers

```http
X-API-Key-ID: key_abc123
X-Signature: 4f5c6d7e...
X-Timestamp: 1707606000000
X-Nonce: a1b2c3d4e5f6...
```

### Signature Generation

```typescript
canonical = [
  method,       // 'POST'
  path,         // '/api/properties'
  timestamp,    // Unix ms
  nonce,        // Random 32 chars
  body,         // JSON string
].join('\n')

signature = HMAC-SHA256(canonical, apiKeySecret)
```

**Protections:**
- ✅ Replay attack prevention (nonce)
- ✅ Timestamp validation (5 min window)
- ✅ Timing-safe comparison
- ✅ Multiple API key support

---

## 🛡️ Security Headers

All responses include:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'none'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | All features disabled |
| `Cache-Control` | `no-store` (for sensitive endpoints) |

---

## 📜 GDPR Compliance

### Data Subject Rights (DSR)

| Right | Article | Implementation |
|-------|---------|----------------|
| Access | Art. 15 | ✅ Export all user data |
| Rectification | Art. 16 | ✅ Update endpoints |
| Erasure | Art. 17 | ✅ Soft delete + hard delete |
| Restriction | Art. 18 | ✅ Account suspension |
| Portability | Art. 20 | ✅ JSON export |
| Object | Art. 21 | ✅ Marketing opt-out |

### Consent Management

```typescript
recordConsent(userId, 'marketing_emails', LegalBasis.CONSENT, [
  DataCategory.BASIC_IDENTITY,
  DataCategory.BEHAVIORAL,
])

hasConsent(userId, 'marketing_emails') // true/false
revokeConsent(consentId)
```

### Processing Activities Record (Art. 30)

```typescript
recordProcessingActivity({
  name: 'Property Management',
  purpose: 'Real estate listing and management',
  legalBasis: LegalBasis.CONTRACT,
  dataCategories: [DataCategory.BASIC_IDENTITY, DataCategory.LOCATION],
  dataSubjects: ['property_owners', 'tenants'],
  recipients: ['internal_staff'],
  retentionPeriod: '3 years after relationship ends',
  securityMeasures: ['encryption', 'access_control', 'audit_logs'],
})
```

### Data Retention Policies

| Category | Retention | Action |
|----------|-----------|--------|
| Basic Identity | 3 years post-relationship | Anonymize |
| Financial | 7 years (tax) | Archive |
| Communications | 1 year | Delete |
| Behavioral | 6 months | Delete |
| Location | 30 days | Delete |

### Breach Notification Framework

```typescript
recordDataBreach({
  detectedAt: new Date(),
  nature: 'Unauthorized access to client database',
  dataCategories: [DataCategory.BASIC_IDENTITY],
  approximateRecords: 500,
  consequences: 'Email and phone numbers exposed',
  measuresToken: ['password_reset', 'enhanced_monitoring'],
  riskLevel: 'high',  // Triggers 72h notification requirement
})
```

---

## 🔍 SOC2 Readiness

### Trust Service Criteria Coverage

| Principle | Controls | Status |
|-----------|----------|--------|
| **Security** | Access controls, encryption, monitoring | ✅ |
| **Availability** | Health checks, error handling | ✅ |
| **Processing Integrity** | Input validation, audit trail | ✅ |
| **Confidentiality** | Encryption, masking, access control | ✅ |
| **Privacy** | GDPR framework, consent management | ✅ |

### Key Controls Implemented

1. **CC6.1** - Logical access security
   - JWT authentication
   - Role-based access
   - Session management

2. **CC6.2** - Access removal
   - Session termination
   - Token revocation
   - Account deactivation

3. **CC6.6** - Encryption
   - TLS in transit
   - AES-256-GCM at rest
   - Key management

4. **CC7.1** - Security monitoring
   - Audit logging
   - Rate limit monitoring
   - Anomaly detection

5. **CC7.2** - Incident response
   - Breach framework
   - Lockout policies
   - Alert mechanisms

---

## 🔧 Security Configuration

### Required Environment Variables

```bash
# JWT (minimum 32 chars, recommended 64+)
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_ISSUER=inmobiliaria-system
JWT_AUDIENCE=inmobiliaria-api
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Encryption (minimum 32 chars)
ENCRYPTION_MASTER_KEY=your-encryption-master-key-here

# Security
ENABLE_HSTS=true
COOKIE_SECURE=true  # Required in production
CSP_REPORT_URI=https://your-csp-report-endpoint

# Session
MAX_CONCURRENT_SESSIONS=5

# Lockout
LOCKOUT_MAX_ATTEMPTS=5

# MFA
MFA_ISSUER=Inmobiliaria System

# WebAuthn (if using)
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_ORIGIN=https://yourdomain.com
```

### Health Check Endpoint

```bash
GET /health/security
```

Returns security configuration status:

```json
{
  "score": 10,
  "maxScore": 10,
  "checks": [
    { "name": "JWT Secret Strength", "passed": true },
    { "name": "Encryption Key Strength", "passed": true },
    { "name": "HTTPS Enforced", "passed": true },
    { "name": "Rate Limiting Active", "passed": true },
    { "name": "Audit Logging Active", "passed": true },
    { "name": "Data Masking Active", "passed": true },
    { "name": "Session Security Active", "passed": true },
    { "name": "MFA Infrastructure Ready", "passed": true },
    { "name": "GDPR Framework Active", "passed": true }
  ]
}
```

---

## 📊 Monitoring & Alerts

### Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| Failed logins | >10/min |
| Rate limit violations | >50/min |
| Account lockouts | >5/hour |
| Session anomalies | Any |
| Token reuse detected | Any |
| Malicious uploads | Any |

### Log Aggregation

Structured JSON logs ready for:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch Logs
- Datadog

---

## ✅ Security Checklist

### Authentication
- [x] JWT with aud/iss validation
- [x] Token rotation (refresh)
- [x] Family-based revocation
- [x] Strong password policy
- [x] Account lockout
- [x] MFA infrastructure
- [x] Session management
- [x] Device fingerprinting

### API Security
- [x] Rate limiting (sliding window)
- [x] Request signing (HMAC)
- [x] CORS configuration
- [x] Input validation (Zod)
- [x] SQL injection prevention
- [x] Security headers

### Data Security
- [x] Field-level encryption
- [x] Data masking
- [x] Audit trail
- [x] Key rotation support

### Compliance
- [x] GDPR rights implementation
- [x] Consent management
- [x] Processing records
- [x] Breach framework
- [x] Data retention policies
- [x] SOC2 control mapping

---

*Security documentation v2.0 - 2026-02-10*
