import { sign, verify } from 'hono/jwt'
import { env } from '../env.js'
import type { AuthUser, UserRole } from '../middleware/rbac.js'

const VALID_ROLES: UserRole[] = ['colaborador', 'gestor', 'rh', 'diretoria', 'admin']

function parseRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value)) return ['colaborador']
  const roles = value.filter((role): role is UserRole => typeof role === 'string' && VALID_ROLES.includes(role as UserRole))
  return roles.length > 0 ? roles : ['colaborador']
}

function parseGroups(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((group): group is string => typeof group === 'string')
}

export async function createSessionToken(user: AuthUser): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = Math.max(60, env.authSessionMinutes * 60)
  const now = Math.floor(Date.now() / 1000)

  const token = await sign(
    {
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
      iat: now,
      exp: now + expiresIn,
    },
    env.authSessionSecret,
    'HS256'
  )

  return { token, expiresIn }
}

export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = await verify(token, env.authSessionSecret, 'HS256')
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
  } catch {
    return null
  }
}
