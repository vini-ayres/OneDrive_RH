/**
 * Atualiza credenciais do banco em server/.env de forma segura.
 * Uso: npx tsx scripts/write-db-env.ts <user> <password> [database]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , user, password, database = 'onedrive_rh'] = process.argv
const host = process.env.DB_HOST || 'localhost'
const port = process.env.DB_PORT || '5433'

if (!user || !password) {
  console.error('Uso: npx tsx scripts/write-db-env.ts <user> <password> [database]')
  process.exit(1)
}

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(serverDir, '.env')

const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`

let content = ''
try {
  content = readFileSync(envPath, 'utf-8')
} catch {
  content = ''
}

const lines = content.length > 0 ? content.split('\n') : []
const updates: Record<string, string> = {
  DATABASE_URL: databaseUrl,
  DB_USER: user,
  DB_PASSWORD: password,
  DB_HOST: host,
  DB_PORT: port,
  DB_NAME: database,
}

const keys = new Set(Object.keys(updates))
const out: string[] = []
const seen = new Set<string>()

for (const line of lines) {
  const match = line.match(/^([A-Z_]+)=/)
  if (match && keys.has(match[1])) {
    if (!seen.has(match[1])) {
      out.push(`${match[1]}=${updates[match[1]]}`)
      seen.add(match[1])
    }
    continue
  }
  out.push(line)
}

for (const [key, value] of Object.entries(updates)) {
  if (!seen.has(key)) {
    out.push(`${key}=${value}`)
  }
}

writeFileSync(envPath, out.filter((l, i, arr) => !(l === '' && i === arr.length - 1)).join('\n') + '\n')
console.log(`Credenciais gravadas em ${envPath}`)
