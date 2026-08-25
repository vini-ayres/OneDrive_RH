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

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function domainFromBaseDn(baseDn: string): string {
  return baseDn
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.toUpperCase().startsWith('DC='))
    .map((part) => part.slice(3))
    .join('.')
}

const ldapBaseDn = process.env.LDAP_BASE_DN || ''

export const env = {
  port: Number(process.env.PORT || 8787),
  databaseUrl: buildDatabaseUrl(),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  authSessionSecret: required('AUTH_SESSION_SECRET', 'change-me-in-production'),
  authSessionMinutes: Number(process.env.AUTH_SESSION_MINUTES || 30),
  ldap: {
    url: process.env.LDAP_URL || '',
    baseDn: ldapBaseDn,
    bindDn: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    useTls: parseBool(process.env.LDAP_USE_TLS, false),
    groupDn: process.env.LDAP_GROUP_DN || '',
    adminGroupDn: process.env.LDAP_ADMIN_GROUP_DN || '',
    domain: process.env.LDAP_DOMAIN || domainFromBaseDn(ldapBaseDn),
  },
  n8nInternalApiKey: process.env.N8N_INTERNAL_API_KEY || 'change-me-in-production',
  auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS || 730),
}
