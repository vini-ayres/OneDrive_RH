const EXCLUDED_USER_IDS = new Set(['local-test-user'])
const EXCLUDED_EMAILS = ['teste.local@empresa.local']

function normalizeName(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
}

const EXCLUDED_NAMES = new Set(['usuariodetestelocal', 'local-test-user'])

export function isExcludedTestUser(user?: {
  userId?: string | null
  userName?: string | null
  email?: string | null
  userEmail?: string | null
}): boolean {
  if (!user) return false
  const id = (user.userId || '').toLowerCase()
  const email = (user.email || user.userEmail || '').toLowerCase()
  const name = normalizeName(user.userName)
  return EXCLUDED_USER_IDS.has(id) || EXCLUDED_NAMES.has(name) || EXCLUDED_EMAILS.includes(email)
}
