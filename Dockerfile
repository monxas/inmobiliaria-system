# Multi-stage: Bun primary
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun build backend/src/index.ts --outdir dist --target bun

FROM oven/bun:1-alpine AS production
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/database ./database
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
