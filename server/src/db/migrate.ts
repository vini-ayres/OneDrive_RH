import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { env } from '../env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const client = new pg.Client({ connectionString: env.databaseUrl })
  await client.connect()

  try {
    const migrationsDir = join(__dirname, 'migrations')
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8')
      console.log(`Running migration: ${file}`)
      await client.query(sql)
    }

    console.log('Migrations completed successfully.')
  } finally {
    await client.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
