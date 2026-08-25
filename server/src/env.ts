import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function buildDatabaseUrl(): string {
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '5433'
  const database = process.env.DB_NAME || 'onedrive_rh'

  if (user && password) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
  }

  return required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5433/onedrive_rh')
}

export const env = {
  port: Number(process.env.PORT || 8787),
  databaseUrl: buildDatabaseUrl(),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  authApiUrl: (process.env.AUTH_API_URL || 'http://localhost:8080/api/auth').replace(/\/+$/, ''),
  n8nInternalApiKey: process.env.N8N_INTERNAL_API_KEY || 'change-me-in-production',
  localTestAccessToken: process.env.LOCAL_TEST_ACCESS_TOKEN || 'local-test-token',
  auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS || 730),
}
