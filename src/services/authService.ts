import { UserProfile, UserRole } from '../types'
import { getRolesFromGroups } from '../utils/rbac'

export interface LdapLoginCredentials {
  username: string
  password: string
}

export interface LdapLoginResponse {
  user: {
    id: string
    displayName: string
    email: string
    username?: string
    jobTitle?: string
    department?: string
    officeLocation?: string
    mobilePhone?: string
    photoUrl?: string
    groups: string[]
    roles?: UserRole[]
  }
  accessToken: string
  expiresIn?: number
}

const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || '/api/auth').replace(/\/+$/, '')

function getLoginEndpoint(): string {
  return `${AUTH_API_URL}/login`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseLoginResponse(payload: unknown): LdapLoginResponse {
  if (!isRecord(payload)) {
    throw new Error('Resposta inválida do servidor de autenticação.')
  }

  const data = isRecord(payload.data) ? payload.data : payload
  const user = isRecord(data.user) ? data.user : data

  const accessToken =
    typeof data.accessToken === 'string'
      ? data.accessToken
      : typeof data.token === 'string'
        ? data.token
        : ''

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
    : undefined

  return {
    accessToken,
    expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : undefined,
    user: {
      id,
      displayName,
      email,
      username: typeof user.username === 'string' ? user.username : id,
      jobTitle: typeof user.jobTitle === 'string' ? user.jobTitle : '',
      department: typeof user.department === 'string' ? user.department : '',
      officeLocation: typeof user.officeLocation === 'string' ? user.officeLocation : '',
      mobilePhone: typeof user.mobilePhone === 'string' ? user.mobilePhone : '',
      photoUrl: typeof user.photoUrl === 'string' ? user.photoUrl : undefined,
      groups,
      roles,
    },
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    const message = [payload.message, payload.error, payload.detail]
      .find(value => typeof value === 'string' && value.trim())
    if (typeof message === 'string') return message
  }
  return fallback
}

/**
 * Autentica o usuário via LDAP Bind no backend.
 * O backend validará as credenciais no Active Directory e retornará
 * perfil, grupos e token de sessão.
 */
export async function loginWithLdap(credentials: LdapLoginCredentials): Promise<UserProfile> {
  const username = credentials.username.trim()
  const password = credentials.password

  if (!username || !password) {
    throw new Error('Informe usuário e senha.')
  }

  const response = await fetch(getLoginEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password }),
  })

  const rawText = await response.text()
  let payload: unknown = null

  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText) as unknown
    } catch {
      payload = rawText
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Usuário ou senha inválidos.')
    }
    if (response.status === 403) {
      throw new Error('Acesso negado. Você não pertence a um grupo autorizado.')
    }
    throw new Error(extractErrorMessage(payload, `Erro de autenticação (${response.status}).`))
  }

  const loginData = parseLoginResponse(payload)
  const roles = loginData.user.roles?.length
    ? loginData.user.roles
    : getRolesFromGroups(loginData.user.groups)

  const now = new Date()

  return {
    id: loginData.user.id,
    username: loginData.user.username || loginData.user.id,
    displayName: loginData.user.displayName,
    email: loginData.user.email,
    jobTitle: loginData.user.jobTitle || '',
    department: loginData.user.department || '',
    officeLocation: loginData.user.officeLocation || '',
    mobilePhone: loginData.user.mobilePhone || '',
    photoUrl: loginData.user.photoUrl,
    roles,
    groups: loginData.user.groups,
    accessToken: loginData.accessToken,
    sessionStart: now,
    lastActivity: now,
  }
}
