import type { Context, Next } from 'hono'
import { env } from '../env.js'
import type { AuthUser } from './rbac.js'
import { verifySessionToken } from '../services/sessionToken.js'

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'UNAUTHORIZED', timestamp: new Date().toISOString() }, 401)
  }

  const token = authHeader.slice(7)
  const user = await verifySessionToken(token)
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
