import { sign, verify } from 'hono/jwt'
import { env } from '../env.js'
import type { AuthUser, UserRole } from '../middleware/rbac.js'

const VALID_ROLES: UserRole[] = ['colaborador', 'gestor', 'rh', 'diretoria', 'admin']

export type TokenKind = 'session' | 'mfa_pending'
export type MfaPendingPurpose = 'enroll' | 'verify'

export type VerifiedToken = {
  kind: TokenKind
  purpose?: MfaPendingPurpose
  tokenVersion: number
  user: AuthUser
}

function parseRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return ['colaborador']
  const roles = value.filter((role): role is UserRole => typeof role === 'string' && VALID_ROLES.includes(role as UserRole))
  return roles.length > 0 ? roles : ['colaborador']
}

function parseGroups(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((group): group is string => typeof group === 'string')
}

function userClaims(user: AuthUser) {
  return {
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    roles: user.roles,
    groups: user.groups,
    jobTitle: user.jobTitle || '',
    department: user.department || '',
    officeLocation: user.officeLocation || '',
    mobilePhone: user.mobilePhone || '',
  }
}

function userFromPayload(payload: Record<string, unknown>): AuthUser | null {
  const id =
    typeof payload.sub === 'string'
      ? payload.sub
      : typeof payload.username === 'string'
        ? payload.username
        : ''

  if (!id) return null

  return {
    id,
    username: typeof payload.username === 'string' ? payload.username : id,
    displayName: typeof payload.displayName === 'string' ? payload.displayName : id,
    email: typeof payload.email === 'string' ? payload.email : '',
    roles: parseRoles(payload.roles),
    groups: parseGroups(payload.groups),
    jobTitle: typeof payload.jobTitle === 'string' ? payload.jobTitle : '',
    department: typeof payload.department === 'string' ? payload.department : '',
    officeLocation: typeof payload.officeLocation === 'string' ? payload.officeLocation : '',
    mobilePhone: typeof payload.mobilePhone === 'string' ? payload.mobilePhone : '',
  }
}

export async function createSessionToken(
  user: AuthUser,
  tokenVersion = 0
): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = Math.max(60, env.authSessionMinutes * 60)
  const now = Math.floor(Date.now() / 1000)

  const token = await sign(
    {
      ...userClaims(user),
      typ: 'session',
      tv: tokenVersion,
      iat: now,
      exp: now + expiresIn,
    },
    env.authSessionSecret,
    'HS256'
  )

  return { token, expiresIn }
}

export async function createMfaPendingToken(
  user: AuthUser,
  purpose: MfaPendingPurpose,
  tokenVersion = 0
): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = Math.max(60, env.authMfaPendingMinutes * 60)
  const now = Math.floor(Date.now() / 1000)

  const token = await sign(
    {
      ...userClaims(user),
      typ: 'mfa_pending',
      purpose,
      tv: tokenVersion,
      iat: now,
      exp: now + expiresIn,
    },
    env.authSessionSecret,
    'HS256'
  )

  return { token, expiresIn }
}

export async function verifyAuthToken(token: string): Promise<VerifiedToken | null> {
  try {
    const payload = (await verify(token, env.authSessionSecret, 'HS256')) as Record<string, unknown>
    const user = userFromPayload(payload)
    if (!user) return null

    const typ = payload.typ === 'mfa_pending' ? 'mfa_pending' : 'session'
    const purpose =
      payload.purpose === 'enroll' || payload.purpose === 'verify' ? payload.purpose : undefined
    const tokenVersion = typeof payload.tv === 'number' && Number.isFinite(payload.tv) ? payload.tv : 0

    if (typ === 'mfa_pending' && !purpose) return null

    return { kind: typ, purpose, tokenVersion, user }
  } catch {
    return null
  }
}

export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  const verified = await verifyAuthToken(token)
  if (!verified || verified.kind !== 'session') return null
  return verified.user
}
