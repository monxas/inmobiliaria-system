# ADR-001: Bun as Primary Runtime

## Status

Accepted

## Date

2026-02-10

## Context

We need a JavaScript/TypeScript runtime for the backend API. The primary deployment target is a NAS with limited resources (4-8GB RAM), so startup time, memory usage, and cold start performance are critical.

Options considered:
- Node.js (traditional, mature ecosystem)
- Deno (modern, secure by default)
- Bun (ultra-fast, TypeScript native)

## Decision

Use **Bun** as the primary runtime for the backend API, with Node.js as a fallback for ARM platforms where Bun may have compatibility issues.

## Consequences

### Positive
- **3x faster startup** compared to Node.js (~150ms vs ~500ms)
- **Native TypeScript support** — no transpilation step needed
- **Built-in test runner** — eliminates need for Vitest/Jest
- **Smaller memory footprint** — important for NAS deployment
- **Compatible with npm ecosystem** — most packages work without changes
- **Built-in SQLite** — though we use PostgreSQL, it's available if needed

### Negative
- **Less mature** than Node.js — may encounter edge cases
- **ARM64 support** still maturing — may need Node fallback
- **Smaller community** — fewer Stack Overflow answers, tutorials
- **Some npm packages** may not work due to native dependencies

### Neutral
- Dockerfile uses multi-stage build with both runtimes as fallback
- Development team needs to learn Bun-specific APIs
- CI/CD pipeline needs Bun installation step

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|------------|------|------|--------------|
| Node.js | Mature, huge ecosystem, stable | Slower startup, requires transpilation, larger memory | Performance requirements favor Bun |
| Deno | Secure by default, TypeScript native | Smaller ecosystem, npm compat layer still evolving | Less npm compatibility |

## References

- [Bun Documentation](https://bun.sh/docs)
- [Bun Performance Benchmarks](https://bun.sh/docs/benchmarks)
- [Node.js vs Bun Comparison](https://blog.logrocket.com/bun-vs-node-js/)
