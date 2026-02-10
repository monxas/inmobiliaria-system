/**
 * @fileoverview Application constants - eliminates magic numbers/strings.
 * 
 * All configurable values and limits are centralized here for:
 * - Easy maintenance
 * - Type safety
 * - Documentation
 */

// ============================================
// PAGINATION
// ============================================

export const PAGINATION = {
  /** Default page number */
  DEFAULT_PAGE: 1,
  /** Default items per page */
  DEFAULT_LIMIT: 10,
  /** Minimum items per page */
  MIN_LIMIT: 1,
  /** Maximum items per page */
  MAX_LIMIT: 100,
} as const

// ============================================
// RATE LIMITING
// ============================================

export const RATE_LIMITS = {
  /** Default requests per window */
  DEFAULT_MAX_REQUESTS: 100,
  /** Default window duration in ms */
  DEFAULT_WINDOW_MS: 60_000,
  /** Auth endpoint max requests */
  AUTH_MAX_REQUESTS: 10,
  /** Auth endpoint window in ms */
  AUTH_WINDOW_MS: 60_000,
  /** Upload endpoint max requests */
  UPLOAD_MAX_REQUESTS: 20,
  /** Upload endpoint window in ms */
  UPLOAD_WINDOW_MS: 60_000,
} as const

// ============================================
// AUTHENTICATION
// ============================================

export const AUTH = {
  /** JWT access token expiry */
  ACCESS_TOKEN_EXPIRY: '15m',
  /** JWT refresh token expiry */
  REFRESH_TOKEN_EXPIRY: '7d',
  /** Bcrypt salt rounds */
  BCRYPT_ROUNDS: 12,
  /** Token header prefix */
  BEARER_PREFIX: 'Bearer ',
  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 8,
  /** Maximum password length */
  MAX_PASSWORD_LENGTH: 100,
  /** Session inactivity timeout in ms */
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,
} as const

// ============================================
// FILE MANAGEMENT
// ============================================

export const FILES = {
  /** Maximum file size in bytes (50MB) */
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  /** Default chunk size for streaming */
  CHUNK_SIZE: 64 * 1024,
  /** Allowed image types */
  IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
  /** Allowed document types */
  DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
  /** Image size limits by category (bytes) */
  SIZE_LIMITS: {
    property_images: 10 * 1024 * 1024,
    property_docs: 25 * 1024 * 1024,
    client_docs: 25 * 1024 * 1024,
    contracts: 50 * 1024 * 1024,
    other: 10 * 1024 * 1024,
  } as const,
} as const

// ============================================
// VALIDATION
// ============================================

export const VALIDATION = {
  /** Email max length */
  EMAIL_MAX_LENGTH: 255,
  /** Name min length */
  NAME_MIN_LENGTH: 2,
  /** Name max length */
  NAME_MAX_LENGTH: 255,
  /** Title min length */
  TITLE_MIN_LENGTH: 3,
  /** Title max length */
  TITLE_MAX_LENGTH: 255,
  /** Description max length */
  DESCRIPTION_MAX_LENGTH: 10_000,
  /** Address min length */
  ADDRESS_MIN_LENGTH: 5,
  /** Address max length */
  ADDRESS_MAX_LENGTH: 500,
  /** Phone max length */
  PHONE_MAX_LENGTH: 50,
  /** URL max length */
  URL_MAX_LENGTH: 500,
  /** Notes max length */
  NOTES_MAX_LENGTH: 5_000,
  /** Search query max length */
  SEARCH_MAX_LENGTH: 200,
  /** Maximum property bedrooms */
  MAX_BEDROOMS: 100,
  /** Maximum property bathrooms */
  MAX_BATHROOMS: 50,
  /** Maximum surface area (m²) */
  MAX_SURFACE_AREA: 1_000_000,
} as const

// ============================================
// HTTP STATUS CODES
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

export type HttpStatusCode = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]

// ============================================
// CACHE
// ============================================

export const CACHE = {
  /** Default TTL in seconds */
  DEFAULT_TTL: 300,
  /** Short TTL in seconds */
  SHORT_TTL: 60,
  /** Long TTL in seconds */
  LONG_TTL: 3600,
  /** User data TTL in seconds */
  USER_TTL: 300,
  /** Property list TTL in seconds */
  PROPERTY_LIST_TTL: 60,
} as const

// ============================================
// DATABASE
// ============================================

export const DATABASE = {
  /** Default query limit */
  DEFAULT_LIMIT: 10,
  /** Maximum query limit */
  MAX_LIMIT: 1000,
  /** Connection pool min */
  POOL_MIN: 2,
  /** Connection pool max */
  POOL_MAX: 10,
  /** Query timeout in ms */
  QUERY_TIMEOUT_MS: 30_000,
  /** Connection timeout in ms */
  CONNECTION_TIMEOUT_MS: 10_000,
} as const

// ============================================
// LOGGING
// ============================================

export const LOGGING = {
  /** Log levels */
  LEVELS: {
    DEBUG: 10,
    INFO: 20,
    WARN: 30,
    ERROR: 40,
    FATAL: 50,
  } as const,
  /** Maximum log message length */
  MAX_MESSAGE_LENGTH: 10_000,
  /** Maximum context object depth */
  MAX_CONTEXT_DEPTH: 5,
} as const

// ============================================
// SECURITY
// ============================================

export const SECURITY = {
  /** CORS max age in seconds */
  CORS_MAX_AGE: 86400,
  /** CSP directives */
  CSP_DIRECTIVES: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
  } as const,
  /** Allowed origins (configured via env) */
  ALLOWED_ORIGINS: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
  /** Request body max size */
  MAX_BODY_SIZE: '10mb',
} as const

// ============================================
// TIMEOUTS
// ============================================

export const TIMEOUTS = {
  /** API request timeout in ms */
  API_REQUEST_MS: 30_000,
  /** Database query timeout in ms */
  DB_QUERY_MS: 15_000,
  /** External service timeout in ms */
  EXTERNAL_SERVICE_MS: 10_000,
  /** File upload timeout in ms */
  FILE_UPLOAD_MS: 60_000,
  /** Health check timeout in ms */
  HEALTH_CHECK_MS: 5_000,
} as const

// ============================================
// RETRY STRATEGIES
// ============================================

export const RETRY = {
  /** Maximum retry attempts */
  MAX_ATTEMPTS: 3,
  /** Initial delay in ms */
  INITIAL_DELAY_MS: 100,
  /** Maximum delay in ms */
  MAX_DELAY_MS: 5_000,
  /** Exponential backoff multiplier */
  BACKOFF_MULTIPLIER: 2,
} as const

// ============================================
// API VERSIONING
// ============================================

export const API = {
  /** Current API version */
  VERSION: 'v1',
  /** API prefix */
  PREFIX: '/api/v1',
  /** Health endpoint */
  HEALTH_PATH: '/health',
} as const

// ============================================
// Type Exports
// ============================================

export type FileCategory = keyof typeof FILES.SIZE_LIMITS
export type LogLevel = keyof typeof LOGGING.LEVELS
