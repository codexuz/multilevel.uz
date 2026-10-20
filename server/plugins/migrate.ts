import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import postgres from 'postgres'

/**
 * Brings the database up to date when the server starts: every migration in
 * server/database/migrations not yet applied runs, in order, in one transaction. Requests wait
 * until it is done; if it fails in production the process exits, so the deploy's health check
 * fails and the running version stays up. An advisory lock keeps two starting containers from
 * migrating at once. Set DB_MIGRATE=false to skip it (then run `npm run db:migrate` yourself).
 *
 * A database with tables but none of these migrations recorded (left over from an earlier app) is
 * refused rather than migrated over. Set DB_DROP_LEGACY_TABLES=true for one deploy to drop those
 * tables and start fresh; once this app's first migration is recorded the setting does nothing.
 */
const LOCK_ID = 7_340_115

async function runMigrations() {
  const url = process.env.DATABASE_URL || useRuntimeConfig().databaseUrl
  if (!url) throw new Error('DATABASE_URL is not set')
  const migrationsFolder = process.env.MIGRATIONS_DIR || resolve(process.cwd(), 'server/database/migrations')
  const ours = readMigrationFiles({ migrationsFolder })

  // One connection, so the lock, the checks and the migration share a session.
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await client`SELECT pg_advisory_lock(${LOCK_ID})`

    const [{ tables }] = await client<[{ tables: number }]>`SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public'`
    const [{ log }] = await client<[{ log: boolean }]>`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS log`
    const applied = log ? (await client<{ hash: string }[]>`SELECT hash FROM drizzle.__drizzle_migrations`).map(r => r.hash) : []
    const known = applied.filter(h => ours.some(m => m.hash === h)).length

    if (tables > 0 && !known) {
      if (process.env.DB_DROP_LEGACY_TABLES !== 'true') {
        throw new Error(`The database has ${tables} tables from something else and none of this app's migrations. Use an empty database, or set DB_DROP_LEGACY_TABLES=true for one deploy to drop them.`)
      }
      console.warn(`[migrate] Dropping ${tables} legacy tables (DB_DROP_LEGACY_TABLES=true)`)
      await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    }

    const pending = ours.length - known
    if (pending > 0) console.info(`[migrate] Applying ${pending} migration(s)`)
    await migrate(drizzle(client), { migrationsFolder })
    if (pending > 0) console.info('[migrate] Database is up to date')
  } finally {
    await client`SELECT pg_advisory_unlock(${LOCK_ID})`.catch(() => {})
    await client.end({ timeout: 5 })
  }
}

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.prerender || process.env.DB_MIGRATE === 'false') return

  const ready = runMigrations().catch((error) => {
    console.error('[migrate] Migration failed:', error)
    if (!import.meta.dev) process.exit(1)
  })
  nitroApp.hooks.hook('request', () => ready)
})
