import { Client, InvalidCredentialsError } from 'ldapts'
import { env } from '../env.js'
import { getRolesFromGroups, type AuthUser } from '../middleware/rbac.js'

export class LdapAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 503,
    readonly code: 'INVALID_CREDENTIALS' | 'ACCESS_DENIED' | 'LDAP_UNAVAILABLE' | 'LDAP_NOT_CONFIGURED'
  ) {
    super(message)
    this.name = 'LdapAuthError'
  }
}

const SEARCH_ATTRIBUTES = [
  'dn',
  'distinguishedName',
  'sAMAccountName',
  'userPrincipalName',
  'displayName',
  'cn',
  'mail',
  'title',
  'department',
  'physicalDeliveryOfficeName',
  'mobile',
  'telephoneNumber',
  'memberOf',
]

function escapeLdapFilter(value: string): string {
  return value.replace(/[\\*\(\)\0]/g, (char) => {
    const encoded: Record<string, string> = {
      '\\': '\\5c',
      '*': '\\2a',
      '(': '\\28',
      ')': '\\29',
      '\0': '\\00',
    }
    return encoded[char] ?? char
  })
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  if (Array.isArray(value) && value.length > 0) return asString(value[0])
  return ''
}

function asStringArray(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(asString).filter(Boolean)
  const single = asString(value)
  return single ? [single] : []
}

function attr(entry: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (entry[name] != null) return entry[name]
    const found = Object.keys(entry).find((key) => key.toLowerCase() === name.toLowerCase())
    if (found) return entry[found]
  }
  return undefined
}

function cnFromDn(dn: string): string {
  const first = dn.split(',')[0]?.trim() || dn
  return first.replace(/^CN=/i, '').trim()
}

function normalizeDn(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function groupNames(memberOf: string[], extraDns: string[] = []): string[] {
  const names = new Set<string>()
  for (const dn of [...memberOf, ...extraDns]) {
    const trimmed = dn.trim()
    if (!trimmed) continue
    names.add(trimmed)
    const cn = cnFromDn(trimmed)
    if (cn) names.add(cn)
  }
  return Array.from(names)
}

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ECONNRESET|timeout/i.test(error.message)
}

function createClient(): Client {
  return new Client({
    url: env.ldap.url,
    timeout: 15_000,
    connectTimeout: 10_000,
    strictDN: false,
  })
}

async function closeClient(client: Client): Promise<void> {
  try {
    await client.unbind()
  } catch {
    // conexão já encerrada
  }
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  if (!env.ldap.url) {
    throw new LdapAuthError(
      'LDAP não configurado. Defina LDAP_URL no servidor.',
      503,
      'LDAP_NOT_CONFIGURED'
    )
  }

  const client = createClient()
  try {
    if (env.ldap.useTls && env.ldap.url.startsWith('ldap://')) {
      await client.startTLS()
    }
    return await fn(client)
  } catch (error) {
    if (error instanceof LdapAuthError) throw error
    if (isConnectionError(error)) {
      throw new LdapAuthError(
        'Servidor de autenticação indisponível. Tente novamente em instantes.',
        503,
        'LDAP_UNAVAILABLE'
      )
    }
    throw error
  } finally {
    await closeClient(client)
  }
}

async function bindServiceAccount(client: Client): Promise<void> {
  if (!env.ldap.bindDn || !env.ldap.bindPassword) {
    throw new LdapAuthError(
      'Conta de serviço LDAP não configurada. Defina LDAP_BIND_DN e LDAP_BIND_PASSWORD.',
      503,
      'LDAP_NOT_CONFIGURED'
    )
  }

  try {
    await client.bind(env.ldap.bindDn, env.ldap.bindPassword)
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      throw new LdapAuthError(
        'Falha ao conectar com a conta de serviço do Active Directory.',
        503,
        'LDAP_UNAVAILABLE'
      )
    }
    throw error
  }
}

function buildUserFilter(username: string): string {
  let login = username.trim()
  const slash = Math.max(login.lastIndexOf('\\'), login.lastIndexOf('/'))
  if (slash >= 0) login = login.slice(slash + 1)

  const clauses: string[] = []
  const escapedLogin = escapeLdapFilter(login)

  if (login.includes('@')) {
    const sam = escapeLdapFilter(login.split('@')[0] || login)
    clauses.push(`(sAMAccountName=${sam})`)
    clauses.push(`(userPrincipalName=${escapedLogin})`)
    clauses.push(`(mail=${escapedLogin})`)
  } else {
    clauses.push(`(sAMAccountName=${escapedLogin})`)
    if (env.ldap.domain) {
      const upn = escapeLdapFilter(`${login}@${env.ldap.domain}`)
      clauses.push(`(userPrincipalName=${upn})`)
      clauses.push(`(mail=${upn})`)
    }
    clauses.push(`(mail=${escapedLogin})`)
  }

  return `(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(|${clauses.join('')}))`
}

interface LdapUserEntry {
  dn: string
  username: string
  displayName: string
  email: string
  jobTitle: string
  department: string
  officeLocation: string
  mobilePhone: string
  memberOf: string[]
}

function parseUserEntry(entry: Record<string, unknown>): LdapUserEntry | null {
  const dn = asString(attr(entry, 'dn', 'distinguishedName'))
  const username = asString(attr(entry, 'sAMAccountName')) || asString(attr(entry, 'userPrincipalName'))
  if (!dn || !username) return null

  return {
    dn,
    username,
    displayName:
      asString(attr(entry, 'displayName')) ||
      asString(attr(entry, 'cn')) ||
      username,
    email: asString(attr(entry, 'mail')) || asString(attr(entry, 'userPrincipalName')),
    jobTitle: asString(attr(entry, 'title')),
    department: asString(attr(entry, 'department')),
    officeLocation: asString(attr(entry, 'physicalDeliveryOfficeName')),
    mobilePhone: asString(attr(entry, 'mobile')) || asString(attr(entry, 'telephoneNumber')),
    memberOf: asStringArray(attr(entry, 'memberOf')),
  }
}

function isDirectGroupMember(memberOf: string[], groupDn: string): boolean {
  const targetDn = normalizeDn(groupDn)
  const targetCn = cnFromDn(groupDn).toLowerCase()

  return memberOf.some((group) => {
    const normalized = normalizeDn(group)
    const cn = cnFromDn(group).toLowerCase()
    return normalized === targetDn || (targetCn !== '' && cn === targetCn)
  })
}

async function isNestedGroupMember(client: Client, userDn: string, groupDn: string): Promise<boolean> {
  try {
    const { searchEntries } = await client.search(groupDn, {
      scope: 'base',
      filter: `(member:1.2.840.113556.1.4.1941:=${escapeLdapFilter(userDn)})`,
      attributes: ['dn'],
      sizeLimit: 1,
    })
    return searchEntries.length > 0
  } catch {
    return false
  }
}

async function searchDirectoryUser(username: string): Promise<LdapUserEntry> {
  return withClient(async (client) => {
    await bindServiceAccount(client)

    const { searchEntries } = await client.search(env.ldap.baseDn || env.ldap.bindDn, {
      scope: 'sub',
      filter: buildUserFilter(username),
      attributes: SEARCH_ATTRIBUTES,
      sizeLimit: 5,
      paged: false,
    })

    const user = searchEntries
      .map((entry) => parseUserEntry(entry as Record<string, unknown>))
      .find((entry): entry is LdapUserEntry => entry != null)
    if (!user) {
      throw new LdapAuthError('Usuário ou senha inválidos.', 401, 'INVALID_CREDENTIALS')
    }

    return user
  })
}

async function verifyUserPassword(userDn: string, password: string): Promise<void> {
  await withClient(async (client) => {
    try {
      await client.bind(userDn, password)
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new LdapAuthError('Usuário ou senha inválidos.', 401, 'INVALID_CREDENTIALS')
      }
      if (isConnectionError(error)) {
        throw new LdapAuthError(
          'Servidor de autenticação indisponível. Tente novamente em instantes.',
          503,
          'LDAP_UNAVAILABLE'
        )
      }
      throw new LdapAuthError('Usuário ou senha inválidos.', 401, 'INVALID_CREDENTIALS')
    }
  })
}

function authorizedGroupDns(): string[] {
  return [env.ldap.groupDn, env.ldap.adminGroupDn]
    .map((value) => value.trim())
    .filter(Boolean)
}

async function assertRequiredGroup(user: LdapUserEntry): Promise<string[]> {
  const required = authorizedGroupDns()
  if (required.length === 0) return []

  const matched = required.filter((groupDn) => isDirectGroupMember(user.memberOf, groupDn))
  const pending = required.filter((groupDn) => !matched.includes(groupDn))

  if (pending.length > 0) {
    await withClient(async (client) => {
      await bindServiceAccount(client)
      for (const groupDn of pending) {
        if (await isNestedGroupMember(client, user.dn, groupDn)) {
          matched.push(groupDn)
        }
      }
    })
  }

  if (matched.length === 0) {
    throw new LdapAuthError(
      'Acesso negado. Você não pertence a um grupo autorizado.',
      403,
      'ACCESS_DENIED'
    )
  }

  return matched
}

export async function authenticateWithLdap(username: string, password: string): Promise<AuthUser> {
  if (!env.ldap.url || !env.ldap.baseDn) {
    throw new LdapAuthError(
      'LDAP não configurado. Defina LDAP_URL e LDAP_BASE_DN.',
      503,
      'LDAP_NOT_CONFIGURED'
    )
  }

  const user = await searchDirectoryUser(username)
  await verifyUserPassword(user.dn, password)
  const matchedGroups = await assertRequiredGroup(user)
  const groups = groupNames(user.memberOf, matchedGroups)

  return {
    id: user.username,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    roles: getRolesFromGroups(groups),
    groups,
    jobTitle: user.jobTitle,
    department: user.department,
    officeLocation: user.officeLocation,
    mobilePhone: user.mobilePhone,
  }
}

export function isLdapConfigured(): boolean {
  return Boolean(env.ldap.url && env.ldap.baseDn && env.ldap.bindDn && env.ldap.bindPassword)
}
