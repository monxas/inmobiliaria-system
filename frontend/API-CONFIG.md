# API URL Configuration

The API URL is configured centrally via the `PUBLIC_API_URL` environment variable.

## Files

| File | Purpose |
|------|---------|
| `.env` | Default values (all environments) |
| `.env.development` | Development overrides |
| `.env.production` | Production overrides |
| `src/lib/config.ts` | Central export used by all code |

## How to Change the API URL

### Option 1: Edit `.env` files

```bash
# .env.development
PUBLIC_API_URL=http://localhost:8081/api

# .env.production  
PUBLIC_API_URL=https://api.midominio.com/api
```

### Option 2: System environment variable (overrides .env files)

```bash
PUBLIC_API_URL=https://api.production.com/api npm run build
```

### Option 3: Docker / deployment

```bash
docker run -e PUBLIC_API_URL=https://api.prod.com/api myapp
```

## How It Works

1. `src/lib/config.ts` imports `PUBLIC_API_URL` from SvelteKit's `$env/static/public`
2. All API calls (`src/lib/api/client.ts`, `src/lib/stores/documents.ts`) import from `config.ts`
3. **Single source of truth** — change the env var, everything updates

## Important

- The variable **must** start with `PUBLIC_` for SvelteKit to expose it to the client
- After changing `.env` files, restart the dev server
- For production builds, set the variable **before** running `npm run build` (it's baked in at build time)
