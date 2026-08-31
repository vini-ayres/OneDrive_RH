import type { Context, Next } from 'hono'
import { env } from '../env.js'
import type { AuthUser, Permission } from './rbac.js'
import { hasPermission } from './rbac.js'
import { verifyAuthToken, type MfaPendingPurpose, type VerifiedToken } from '../services/sessionToken.js'
import { getUserTokenVersion } from '../services/userStore.js'

export async function authMiddleware(c: Context, next: Next) {
  const verified = await requireBearer(c)
  if (!verified) return unauthorized(c)
  if (verified.kind !== 'session') return unauthorized(c)

  const currentVersion = await getUserTokenVersion(verified.user.id)
  if (currentVersion != null && verified.tokenVersion !== currentVersion) {
    return unauthorized(c)
  }

  c.set('user', verified.user)
  c.set('verifiedToken', verified)
  return next()
}

export function mfaPendingMiddleware(purpose?: MfaPendingPurpose) {
  return async (c: Context, next: Next) => {
    const verified = await requireBearer(c)
    if (!verified) return unauthorized(c)
    if (verified.kind !== 'mfa_pending') return unauthorized(c)
    if (purpose && verified.purpose !== purpose) return unauthorized(c)

    c.set('user', verified.user)
    c.set('verifiedToken', verified)
    return next()
  }
}

export function requirePermission(permission: keyof Permission) {
  return async (c: Context, next: Next) => {
    const user = getAuthUser(c)
    if (!hasPermission(user, permission)) {
      return c.json(
        { success: false, error: 'FORBIDDEN', timestamp: new Date().toISOString() },
        403
      )
    }
    return next()
  }
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

export function getClientMeta(c: Context): { ipAddress: string; userAgent: string } {
  const forwarded = c.req.header('x-forwarded-for')
  const ipAddress =
    forwarded?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    ''
  return {
    ipAddress,
    userAgent: c.req.header('user-agent') || '',
  }
}

async function requireBearer(c: Context): Promise<VerifiedToken | null> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return verifyAuthToken(authHeader.slice(7))
}

function unauthorized(c: Context) {
  return c.json({ success: false, error: 'UNAUTHORIZED', timestamp: new Date().toISOString() }, 401)
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
    verifiedToken: VerifiedToken
  }
}
