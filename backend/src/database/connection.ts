import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client)

export type Database = PostgresJsDatabase

export async function testConnection(): Promise<void> {
  await client`SELECT 1`
}

export { client }
