import { UserProfile } from '../types'

const SESSION_KEY = 'rh_session'
const LAST_CONVERSATION_KEY = 'rh_last_conversation_id'

interface PersistedSession {
  user: UserProfile
  sessionExpiresAt: string
}

function reviveUser(user: UserProfile): UserProfile {
  return {
    ...user,
    sessionStart: new Date(user.sessionStart),
    lastActivity: new Date(user.lastActivity),
  }
}

export function loadPersistedSession(): {
  user: UserProfile
  sessionExpiresAt: Date
} | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed?.user?.id || !parsed.sessionExpiresAt) return null
    const sessionExpiresAt = new Date(parsed.sessionExpiresAt)
    if (Number.isNaN(sessionExpiresAt.getTime()) || sessionExpiresAt <= new Date()) {
      clearPersistedSession()
      return null
    }
    return {
      user: reviveUser(parsed.user),
      sessionExpiresAt,
    }
  } catch {
    return null
  }
}

export function savePersistedSession(user: UserProfile, sessionExpiresAt: Date) {
  try {
    const payload: PersistedSession = {
      user,
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // storage cheio ou indisponível
  }
}

export function clearPersistedSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(LAST_CONVERSATION_KEY)
  } catch {
    // ignore
  }
}

export function loadLastConversationId(): string | null {
  try {
    return sessionStorage.getItem(LAST_CONVERSATION_KEY)
  } catch {
    return null
  }
}

export function saveLastConversationId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(LAST_CONVERSATION_KEY, id)
    else sessionStorage.removeItem(LAST_CONVERSATION_KEY)
  } catch {
    // ignore
  }
}
