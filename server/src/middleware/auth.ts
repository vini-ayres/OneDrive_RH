import type { Context, Next } from 'hono'
import { env } from '../env.js'
import type { AuthUser, UserRole } from './rbac.js'

const LOCAL_TEST_USER: AuthUser = {
  id: 'local-test-user',
  username: 'teste.local',
  displayName: 'Usuário de Teste Local',
  email: 'teste.local@empresa.local',
  roles: ['admin'],
  groups: ['RH-Sistema-Admin-Local'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRoles(value: unknown): UserRole[] {
  const valid: UserRole[] = ['colaborador', 'gestor', 'rh', 'diretoria', 'admin']
  if (!Array.isArray(value)) return ['colaborador']
  return value.filter((r): r is UserRole => typeof r === 'string' && valid.includes(r as UserRole))
}

function parseAuthUser(payload: unknown, fallbackToken?: string): AuthUser | null {
  if (!isRecord(payload)) return null

  const data = isRecord(payload.data) ? payload.data : payload
  const user = isRecord(data.user) ? data.user : data

  const id =
    typeof user.id === 'string'
      ? user.id
      : typeof user.username === 'string'
        ? user.username
        : ''

  if (!id) return null

  const groups = Array.isArray(user.groups)
    ? user.groups.filter((g): g is string => typeof g === 'string')
    : []

  return {
    id,
    username: typeof user.username === 'string' ? user.username : id,
    displayName:
      typeof user.displayName === 'string'
        ? user.displayName
        : typeof user.display_name === 'string'
          ? user.display_name
          : id,
    email: typeof user.email === 'string' ? user.email : '',
    roles: parseRoles(user.roles),
    groups,
  }
}

async function validateWithAuthApi(token: string): Promise<AuthUser | null> {
  const endpoints = ['/me', '/validate', '/user']

  for (const path of endpoints) {
    try {
      const response = await fetch(`${env.authApiUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 404) continue
      if (!response.ok) return null

      const payload = (await response.json()) as unknown
      return parseAuthUser(payload, token)
    } catch {
      continue
    }
  }

  return null
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'UNAUTHORIZED', timestamp: new Date().toISOString() }, 401)
  }

  const token = authHeader.slice(7)

  if (token === env.localTestAccessToken) {
    c.set('user', LOCAL_TEST_USER)
    return next()
  }

  const user = await validateWithAuthApi(token)
  if (!user) {
    return c.json({ success: false, error: 'UNAUTHORIZED', timestamp: new Date().toISOString() }, 401)
  }

  c.set('user', user)
  return next()
}

export async function internalApiKeyMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey || apiKey !== env.n8nInternalApiKey) {
    return c.json({ success: false, error: 'FORBIDDEN', timestamp: new Date().toISOString() }, 403)
  }
  await next()
}

export function getAuthUser(c: Context): AuthUser {
  return c.get('user') as AuthUser
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}
