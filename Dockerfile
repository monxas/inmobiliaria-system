# Multi-stage: Bun primary, Node fallback
# Stage 1: Install dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Stage 2: Build
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun build backend/src/index.ts --outdir dist --target bun

# Stage 3: Production
FROM oven/bun:1-alpine AS production
WORKDIR /app

RUN apk add --no-cache wget

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/backend/src/database ./backend/src/database
COPY --from=build /app/database ./database

RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]

# --- Node.js Fallback (uncomment if Bun fails on ARM) ---
# FROM node:22-alpine AS node-production
# WORKDIR /app
# RUN apk add --no-cache wget
# COPY package.json ./
# RUN npm install --omit=dev
# COPY . .
# RUN mkdir -p /app/uploads
# EXPOSE 3000
# CMD ["node", "--experimental-strip-types", "backend/src/index.ts"]
