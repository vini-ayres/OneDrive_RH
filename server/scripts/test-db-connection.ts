import 'dotenv/config'
import pg from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  const parsed = new URL(url)
  console.log('User:', parsed.username)
  console.log('Host:', parsed.hostname)
  console.log('Database:', parsed.pathname.slice(1))

  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
    const result = await client.query('SELECT current_user, current_database()')
    console.log('Connected:', result.rows[0])
  } catch (err) {
    console.error('Connection failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
