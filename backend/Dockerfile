FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY . .

FROM oven/bun:1-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /app .
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
