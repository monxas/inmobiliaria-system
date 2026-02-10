import type { Context, Next } from 'hono'

/**
 * Security headers middleware — Helmet equivalent for Hono.
 * Applies security-first defaults suitable for an API server.
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next()

    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff')

    // Prevent clickjacking
    c.header('X-Frame-Options', 'DENY')

    // XSS protection (legacy browsers)
    c.header('X-XSS-Protection', '0')

    // HSTS — enforce HTTPS (1 year, include subdomains)
    if (process.env.ENABLE_HSTS !== 'false') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }

    // CSP — strict for API (no inline scripts/styles needed)
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")

    // Referrer policy
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Permissions policy — disable all browser features
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')

    // Remove server identification
    c.res.headers.delete('X-Powered-By')
    c.res.headers.delete('Server')

    // Cache control for API responses
    if (!c.res.headers.has('Cache-Control')) {
      c.header('Cache-Control', 'no-store')
    }
  }
}
