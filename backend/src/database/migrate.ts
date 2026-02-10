import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './connection'

async function runMigrations() {
  console.log('Running migrations...')
  try {
    await migrate(db, { migrationsFolder: './src/database/migrations' })
    console.log('Migrations completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
  process.exit(0)
}

runMigrations()
