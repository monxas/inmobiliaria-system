import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './connection'
import { logger } from '../lib/logger'

async function runMigrations() {
  logger.info('Running database migrations...')
  try {
    await migrate(db, { migrationsFolder: './src/database/migrations' })
    logger.info('Migrations completed successfully')
  } catch (error) {
    logger.fatal('Migration failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    process.exit(1)
  }
  process.exit(0)
}

runMigrations()
