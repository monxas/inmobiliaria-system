/**
 * Migration runner - applies SQL migrations in order
 * Usage: bun run database/migrate.ts [--rollback]
 */
import postgres from 'postgres';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://app:password@localhost:5432/inmobiliaria';
const MIGRATIONS_DIR = join(import.meta.dir, 'migrations');

const sql = postgres(DATABASE_URL);

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function getAppliedMigrations(): Promise<string[]> {
  const rows = await sql`SELECT name FROM _migrations ORDER BY name`;
  return rows.map((r: any) => r.name);
}

async function applyMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.includes(file)) {
      console.log(`⏭️  Skip: ${file} (already applied)`);
      continue;
    }

    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`🔄 Applying: ${file}...`);

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });

    console.log(`✅ Applied: ${file}`);
    count++;
  }

  if (count === 0) {
    console.log('\n✅ All migrations already applied.');
  } else {
    console.log(`\n✅ Applied ${count} migration(s).`);
  }
}

async function rollbackLast() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  if (applied.length === 0) {
    console.log('No migrations to rollback.');
    return;
  }

  const last = applied[applied.length - 1];
  console.log(`⏪ Rolling back: ${last}`);
  // Note: SQL migrations don't have automatic rollback.
  // For safety, we just remove the record. Manual cleanup may be needed.
  await sql`DELETE FROM _migrations WHERE name = ${last}`;
  console.log(`✅ Rolled back record: ${last}`);
  console.log('⚠️  Note: Table/data changes are NOT automatically reversed. Apply manual DDL if needed.');
}

async function main() {
  try {
    const isRollback = process.argv.includes('--rollback');

    if (isRollback) {
      await rollbackLast();
    } else {
      await applyMigrations();
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
