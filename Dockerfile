# =============================================================================
# LEVEL 1 OPTIMIZED: Multi-stage build for minimum size + maximum security
# Target: <100MB final image
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies - Install production deps only
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy only package files for layer caching
COPY package.json bun.lock* ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production 2>/dev/null || \
    bun install --production

# -----------------------------------------------------------------------------
# Stage 2: Build - Compile TypeScript to optimized bundle
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS build

WORKDIR /app

# Copy full node_modules for build (includes dev deps)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source files
COPY backend/src ./backend/src
COPY tsconfig.json ./

# Build optimized bundle with minification
RUN bun build backend/src/index.ts \
    --outdir dist \
    --target bun \
    --minify \
    --sourcemap=external

# -----------------------------------------------------------------------------
# Stage 3: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Install only wget for health checks (minimal)
RUN apk add --no-cache wget ca-certificates && \
    rm -rf /var/cache/apk/*

# Copy production dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package.json ./

# Copy database migrations (needed at runtime)
COPY --chown=nodejs:nodejs database ./database

# Create uploads directory with correct permissions
RUN mkdir -p /app/uploads && chown nodejs:nodejs /app/uploads

# Security hardening
RUN chmod -R 555 /app/dist && \
    chmod 444 /app/package.json

# Switch to non-root user
USER nodejs

# Metadata
LABEL org.opencontainers.image.title="inmobiliaria-api" \
      org.opencontainers.image.description="Self-hosted real estate management API" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="inmobiliaria-system"

# Health check with optimized parameters
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_FORMAT=json \
    LOG_LEVEL=info

# Start with explicit entrypoint
CMD ["bun", "run", "dist/index.js"]
