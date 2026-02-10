# ADR-004: JWT for Stateless Authentication

## Status

Accepted

## Date

2026-02-10

## Context

We need an authentication mechanism for the API. Requirements:
1. **Stateless** — minimize server-side session storage
2. **Scalable** — no shared session store needed for multiple instances
3. **Secure** — protect against common attacks
4. **Simple** — easy to implement and debug
5. **Cross-platform** — works with web, mobile, and API clients

## Decision

Use **JWT (JSON Web Tokens)** for authentication with:
- **HS256 algorithm** (HMAC-SHA256) for signing
- **7-day expiration** for access tokens
- **Payload contains**: userId, email, role, fullName
- **Refresh tokens** stored in database for token rotation

## Consequences

### Positive
- **Stateless** — no session store required for verification
- **Self-contained** — payload includes all needed user info
- **Cross-domain** — works across different origins/services
- **Standard** — well-documented, libraries in every language
- **Debuggable** — payload is visible (not encrypted)
- **Mobile-friendly** — easy to store and send in headers

### Negative
- **Cannot revoke** individual tokens (until expiry) without blacklist
- **Token size** — larger than session IDs (~200-300 bytes)
- **Payload exposure** — anyone can decode payload (not encrypted)
- **Stateless trade-off** — token revocation requires refresh token DB lookup

### Neutral
- Refresh token rotation provides security for long-lived sessions
- Short expiry (7 days) balances security vs. user experience
- Rate limiting on auth endpoints protects against brute force

## Token Structure

```json
{
  "userId": 123,
  "email": "user@example.com",
  "role": "agent",
  "fullName": "John Doe",
  "iat": 1707580800,
  "exp": 1708185600
}
```

## Security Measures

1. **Strong secret** — 256-bit random JWT_SECRET
2. **HTTPS only** — tokens never sent over HTTP
3. **Rate limiting** — 10 req/min on auth endpoints
4. **Refresh token rotation** — old token invalidated on refresh
5. **Password hashing** — bcrypt with cost factor 12

## Implementation

```typescript
// Sign token
const token = sign(
  { userId: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
)

// Verify token (in middleware)
const payload = verify(token, JWT_SECRET)
c.set('user', {
  id: payload.userId,
  email: payload.email,
  role: payload.role
})
```

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Session cookies | Easy revocation, smaller size | Requires session store, not API-friendly | Stateful, CORS complexity |
| Opaque tokens | Can be revoked instantly | Requires DB lookup every request | Performance overhead |
| OAuth 2.0 | Standard, delegation support | Complex for single app, requires auth server | Over-engineering |
| Paseto | More secure than JWT | Less ecosystem support, newer | Adoption risk |

## Future Considerations

- Implement token blacklist in KeyDB for instant revocation
- Add JTI (JWT ID) claim for per-token revocation
- Consider asymmetric keys (RS256) if multi-service architecture

## References

- [JWT.io](https://jwt.io/)
- [OWASP JWT Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [RFC 7519 - JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
