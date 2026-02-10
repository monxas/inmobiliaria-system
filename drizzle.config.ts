import type { Config } from 'drizzle-kit';

export default {
  schema: './backend/src/database/schema/index.ts',
  out: './database/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://app:password@localhost:5432/inmobiliaria',
  },
} satisfies Config;
