import { UserProfile, UserRole } from '../types'
import { getRolesFromGroups } from '../utils/rbac'

export interface LdapLoginCredentials {
  username: string
  password: string
}

export type MfaLoginStatus = 'mfa_required' | 'mfa_enrollment_required'

export interface MfaChallenge {
  status: MfaLoginStatus
  mfaToken: string
  expiresIn: number
  displayName: string
  username: string
}

export interface MfaEnrollmentStart {
  otpauthUrl: string
  secret: string
}

export interface MfaStatus {
  enabled: boolean
  backupCodesRemaining: number
  enrolledAt: string | null
}

export interface MfaAdminUser {
  id: string
  username: string
  displayName: string | null
  email: string | null
  department: string | null
  roles: UserRole[]
  lastSeenAt: string | null
  mfaEnabled: boolean
  mfaEnrolledAt: string | null
  backupCodesRemaining: number
}

const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || '/api/auth').replace(/\/+$/, '')

function authUrl(path: string): string {
  return `${AUTH_API_URL}${path}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    const message = [payload.message, payload.error, payload.detail]
      .find(value => typeof value === 'string' && value.trim())
    if (typeof message === 'string') return message
  }
  return fallback
}

async function parseJson(response: Response): Promise<unknown> {
  const rawText = await response.text()
  if (!rawText.trim()) return null
  try {
    return JSON.parse(rawText) as unknown
  } catch {
    return rawText
  }
}

function dataOf(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {}
  return isRecord(payload.data) ? payload.data : payload
}

function throwIfFailed(response: Response, payload: unknown, fallback: string): void {
  if (response.ok) return
  if (response.status === 401) {
    throw new Error(extractErrorMessage(payload, 'Código inválido ou sessão expirada.'))
  }
  if (response.status === 403) {
    throw new Error(extractErrorMessage(payload, 'Acesso negado.'))
  }
  if (response.status === 423 || response.status === 429) {
    throw new Error(extractErrorMessage(payload, 'Muitas tentativas. Tente novamente em alguns minutos.'))
  }
  throw new Error(extractErrorMessage(payload, fallback))
}

function parseUserProfile(payload: unknown, fallbackToken?: string): UserProfile {
  const data = dataOf(payload)
  const user = isRecord(data.user) ? data.user : data

  const accessToken =
    typeof data.accessToken === 'string'
      ? data.accessToken
      : typeof data.token === 'string'
        ? data.token
        : fallbackToken || ''

  if (!accessToken) {
    throw new Error('Token de autenticação não recebido.')
  }

  const id = typeof user.id === 'string' ? user.id : typeof user.username === 'string' ? user.username : ''
  const displayName = typeof user.displayName === 'string' ? user.displayName : id
  const email = typeof user.email === 'string' ? user.email : ''

  if (!id || !displayName) {
    throw new Error('Dados do usuário incompletos na resposta de autenticação.')
  }

  const groups = Array.isArray(user.groups)
    ? user.groups.filter((g): g is string => typeof g === 'string')
    : []

  const roles = Array.isArray(user.roles)
    ? user.roles.filter((r): r is UserRole => typeof r === 'string')
    : getRolesFromGroups(groups)

  const now = new Date()

  return {
    id,
    username: typeof user.username === 'string' ? user.username : id,
    displayName,
    email,
    jobTitle: typeof user.jobTitle === 'string' ? user.jobTitle : '',
    department: typeof user.department === 'string' ? user.department : '',
    officeLocation: typeof user.officeLocation === 'string' ? user.officeLocation : '',
    mobilePhone: typeof user.mobilePhone === 'string' ? user.mobilePhone : '',
    photoUrl: typeof user.photoUrl === 'string' ? user.photoUrl : undefined,
    roles: roles.length ? roles : getRolesFromGroups(groups),
    groups,
    accessToken,
    sessionStart: now,
    lastActivity: now,
  }
}

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

export async function startLdapLogin(credentials: LdapLoginCredentials): Promise<MfaChallenge> {
  const username = credentials.username.trim()
  const password = credentials.password

  if (!username || !password) {
    throw new Error('Informe usuário e senha.')
  }

  const response = await fetch(authUrl('/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password }),
  })

  const payload = await parseJson(response)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Usuário ou senha inválidos.')
    }
    if (response.status === 403) {
      throw new Error('Acesso negado. Você não pertence a um grupo autorizado.')
    }
    throwIfFailed(response, payload, `Erro de autenticação (${response.status}).`)
  }

  const data = dataOf(payload)
  const status = data.status === 'mfa_enrollment_required' ? 'mfa_enrollment_required' : 'mfa_required'
  const mfaToken = typeof data.mfaToken === 'string' ? data.mfaToken : ''
  if (!mfaToken) {
    throw new Error('Não foi possível iniciar a verificação em duas etapas.')
  }

  const user = isRecord(data.user) ? data.user : {}
  return {
    status,
    mfaToken,
    expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : 300,
    displayName: typeof user.displayName === 'string' ? user.displayName : username,
    username: typeof user.username === 'string' ? user.username : username,
  }
}

export async function startMfaEnrollment(mfaToken: string): Promise<MfaEnrollmentStart> {
  const response = await fetch(authUrl('/mfa/enroll/start'), {
    method: 'POST',
    headers: authHeaders(mfaToken),
    credentials: 'same-origin',
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível iniciar o cadastro do autenticador.')
  const data = dataOf(payload)
  const otpauthUrl = typeof data.otpauthUrl === 'string' ? data.otpauthUrl : ''
  const secret = typeof data.secret === 'string' ? data.secret : ''
  if (!otpauthUrl || !secret) {
    throw new Error('Resposta inválida ao gerar o autenticador.')
  }
  return { otpauthUrl, secret }
}

export async function confirmMfaEnrollment(
  mfaToken: string,
  code: string
): Promise<{ user: UserProfile; backupCodes: string[] }> {
  const response = await fetch(authUrl('/mfa/enroll/confirm'), {
    method: 'POST',
    headers: authHeaders(mfaToken, true),
    credentials: 'same-origin',
    body: JSON.stringify({ code }),
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível confirmar o autenticador.')
  const data = dataOf(payload)
  const backupCodes = Array.isArray(data.backupCodes)
    ? data.backupCodes.filter((item): item is string => typeof item === 'string')
    : []
  return { user: parseUserProfile(payload), backupCodes }
}

export async function verifyMfaCode(mfaToken: string, code: string): Promise<UserProfile> {
  const response = await fetch(authUrl('/mfa/verify'), {
    method: 'POST',
    headers: authHeaders(mfaToken, true),
    credentials: 'same-origin',
    body: JSON.stringify({ code }),
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível verificar o código.')
  return parseUserProfile(payload)
}

export async function fetchMfaStatus(accessToken: string): Promise<MfaStatus> {
  const response = await fetch(authUrl('/mfa/status'), {
    headers: authHeaders(accessToken),
    credentials: 'same-origin',
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível carregar o status do MFA.')
  const data = dataOf(payload)
  return {
    enabled: Boolean(data.enabled),
    backupCodesRemaining: typeof data.backupCodesRemaining === 'number' ? data.backupCodesRemaining : 0,
    enrolledAt: typeof data.enrolledAt === 'string' ? data.enrolledAt : null,
  }
}

export async function regenerateMfaBackupCodes(accessToken: string, code: string): Promise<string[]> {
  const response = await fetch(authUrl('/mfa/backup/regenerate'), {
    method: 'POST',
    headers: authHeaders(accessToken, true),
    credentials: 'same-origin',
    body: JSON.stringify({ code }),
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível gerar novos códigos de recuperação.')
  const data = dataOf(payload)
  return Array.isArray(data.backupCodes)
    ? data.backupCodes.filter((item): item is string => typeof item === 'string')
    : []
}

export async function startMfaReplace(accessToken: string, code: string): Promise<MfaEnrollmentStart> {
  const response = await fetch(authUrl('/mfa/replace/start'), {
    method: 'POST',
    headers: authHeaders(accessToken, true),
    credentials: 'same-origin',
    body: JSON.stringify({ code }),
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível iniciar a troca do autenticador.')
  const data = dataOf(payload)
  const otpauthUrl = typeof data.otpauthUrl === 'string' ? data.otpauthUrl : ''
  const secret = typeof data.secret === 'string' ? data.secret : ''
  if (!otpauthUrl || !secret) {
    throw new Error('Resposta inválida ao gerar o novo autenticador.')
  }
  return { otpauthUrl, secret }
}

export async function confirmMfaReplace(accessToken: string, code: string): Promise<void> {
  const response = await fetch(authUrl('/mfa/replace/confirm'), {
    method: 'POST',
    headers: authHeaders(accessToken, true),
    credentials: 'same-origin',
    body: JSON.stringify({ code }),
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível confirmar o novo autenticador.')
}

export async function fetchMfaAdminUsers(accessToken: string): Promise<MfaAdminUser[]> {
  const response = await fetch(authUrl('/mfa/admin/users'), {
    headers: authHeaders(accessToken),
    credentials: 'same-origin',
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível listar os usuários.')
  const data = dataOf(payload)
  const users = Array.isArray(data.users) ? data.users : []
  return users.filter(isRecord).map((row) => ({
    id: typeof row.id === 'string' ? row.id : '',
    username: typeof row.username === 'string' ? row.username : '',
    displayName: typeof row.displayName === 'string' ? row.displayName : null,
    email: typeof row.email === 'string' ? row.email : null,
    department: typeof row.department === 'string' ? row.department : null,
    roles: Array.isArray(row.roles) ? row.roles.filter((r): r is UserRole => typeof r === 'string') : [],
    lastSeenAt: typeof row.lastSeenAt === 'string' ? row.lastSeenAt : null,
    mfaEnabled: Boolean(row.mfaEnabled),
    mfaEnrolledAt: typeof row.mfaEnrolledAt === 'string' ? row.mfaEnrolledAt : null,
    backupCodesRemaining: typeof row.backupCodesRemaining === 'number' ? row.backupCodesRemaining : 0,
  }))
}

export async function resetUserMfa(accessToken: string, userId: string): Promise<void> {
  const response = await fetch(authUrl('/mfa/admin/reset'), {
    method: 'POST',
    headers: authHeaders(accessToken, true),
    credentials: 'same-origin',
    body: JSON.stringify({ userId }),
  })
  const payload = await parseJson(response)
  throwIfFailed(response, payload, 'Não foi possível resetar o MFA.')
}

/** @deprecated Prefer startLdapLogin + MFA steps. Kept for compatibility. */
export async function loginWithLdap(credentials: LdapLoginCredentials): Promise<UserProfile> {
  const challenge = await startLdapLogin(credentials)
  throw new Error(
    challenge.status === 'mfa_enrollment_required'
      ? 'Cadastro de MFA obrigatório.'
      : 'Verificação em duas etapas obrigatória.'
  )
}
