import type { Context, Next } from 'hono'

/**
 * Nonce generator for CSP
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64')
}

/**
 * Security headers configuration
 */
interface SecurityHeadersConfig {
  enableHSTS?: boolean
  hstsMaxAge?: number
  enableCSP?: boolean
  reportUri?: string
  isDevelopment?: boolean
}

/**
 * Security headers middleware — Helmet equivalent for Hono.
 * Applies security-first defaults suitable for an API server.
 * 
 * Headers implemented:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 0 (deprecated, rely on CSP)
 * - Strict-Transport-Security: HSTS
 * - Content-Security-Policy: Strict CSP
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: Disable all features
 * - X-Download-Options: noopen (IE)
 * - X-Permitted-Cross-Domain-Policies: none
 * - Cross-Origin-Opener-Policy: same-origin
 * - Cross-Origin-Resource-Policy: same-origin
 * - Cross-Origin-Embedder-Policy: require-corp
 */
export function securityHeaders(config?: SecurityHeadersConfig) {
  const enableHSTS = config?.enableHSTS ?? (process.env.ENABLE_HSTS !== 'false')
  const hstsMaxAge = config?.hstsMaxAge ?? 31536000 // 1 year
  const enableCSP = config?.enableCSP ?? true
  const reportUri = config?.reportUri ?? process.env.CSP_REPORT_URI
  const isDev = config?.isDevelopment ?? (process.env.NODE_ENV === 'development')

  return async (c: Context, next: Next) => {
    // Generate nonce for this request (if needed for scripts)
    const nonce = generateNonce()
    c.set('cspNonce', nonce)

    await next()

    // ==========================================
    // Basic Security Headers
    // ==========================================
    
    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff')

    // Prevent clickjacking
    c.header('X-Frame-Options', 'DENY')

    // XSS protection - disabled as it can cause vulnerabilities
    // Modern browsers use CSP instead
    c.header('X-XSS-Protection', '0')

    // Prevent IE from opening downloads in site context
    c.header('X-Download-Options', 'noopen')

    // Disable Adobe cross-domain policies
    c.header('X-Permitted-Cross-Domain-Policies', 'none')

    // DNS prefetch control
    c.header('X-DNS-Prefetch-Control', 'off')

    // ==========================================
    // HTTPS / HSTS
    // ==========================================
    
    if (enableHSTS) {
      // HSTS - enforce HTTPS
      // preload: allow inclusion in browser preload lists
      c.header(
        'Strict-Transport-Security',
        `max-age=${hstsMaxAge}; includeSubDomains; preload`
      )
    }

    // ==========================================
    // Content Security Policy
    // ==========================================
    
    if (enableCSP) {
      // Build CSP directives
      const cspDirectives = [
        // Default: deny everything
        "default-src 'none'",
        
        // Allow API to send data back
        "connect-src 'self'",
        
        // Block frames entirely
        "frame-ancestors 'none'",
        
        // Block form submissions to other origins
        "form-action 'self'",
        
        // Only allow same-origin base URIs
        "base-uri 'self'",
        
        // Block object/embed/applet
        "object-src 'none'",
        
        // Upgrade insecure requests in production
        ...(!isDev ? ['upgrade-insecure-requests'] : []),
        
        // Report violations (if configured)
        ...(reportUri ? [`report-uri ${reportUri}`] : []),
      ]

      c.header('Content-Security-Policy', cspDirectives.join('; '))
    }

    // ==========================================
    // Cross-Origin Policies
    // ==========================================
    
    // Prevent window.opener attacks
    c.header('Cross-Origin-Opener-Policy', 'same-origin')
    
    // Restrict resource loading
    c.header('Cross-Origin-Resource-Policy', 'same-origin')
    
    // Require CORP for embedded resources (enables SharedArrayBuffer, etc.)
    // Note: May need adjustment if embedding third-party resources
    if (!isDev) {
      c.header('Cross-Origin-Embedder-Policy', 'require-corp')
    }

    // ==========================================
    // Referrer & Privacy
    // ==========================================
    
    // Control referrer information
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Disable browser features not needed by API
    c.header(
      'Permissions-Policy',
      [
        'accelerometer=()',
        'ambient-light-sensor=()',
        'autoplay=()',
        'battery=()',
        'camera=()',
        'display-capture=()',
        'document-domain=()',
        'encrypted-media=()',
        'fullscreen=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'payment=()',
        'picture-in-picture=()',
        'publickey-credentials-get=()',
        'screen-wake-lock=()',
        'sync-xhr=()',
        'usb=()',
        'web-share=()',
        'xr-spatial-tracking=()',
      ].join(', ')
    )

    // ==========================================
    // Cleanup & Cache Control
    // ==========================================
    
    // Remove server identification headers
    c.res.headers.delete('X-Powered-By')
    c.res.headers.delete('Server')

    // Set cache control for API responses (no caching by default)
    if (!c.res.headers.has('Cache-Control')) {
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      c.header('Pragma', 'no-cache')
      c.header('Expires', '0')
    }

    // Prevent caching of sensitive responses
    if (c.req.path.includes('/auth') || c.req.path.includes('/users')) {
      c.header('Cache-Control', 'no-store')
      c.header('Pragma', 'no-cache')
    }
  }
}

/**
 * Security headers specifically for file downloads
 */
export function downloadSecurityHeaders() {
  return async (c: Context, next: Next) => {
    await next()
    
    // Force download (don't render in browser)
    c.header('X-Content-Type-Options', 'nosniff')
    
    // Sandbox the content
    c.header('Content-Security-Policy', "default-src 'none'; sandbox")
  }
}
