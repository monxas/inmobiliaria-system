import type { Config } from 'drizzle-kit';

export default {
  schema: './backend/src/database/schema/index.ts',
  out: './database/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: (() => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL environment variable is required');
      return url;
    })(),
  },
} satisfies Config;
