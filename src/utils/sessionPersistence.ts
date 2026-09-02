import { UserProfile } from '../types'

export const SESSION_KEY = 'rh_session'
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

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage cheio ou indisponível
  }
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function loadPersistedSession(): {
  user: UserProfile
  sessionExpiresAt: Date
} | null {
  try {
    const raw = readStorage(SESSION_KEY)
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
    writeStorage(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // storage cheio ou indisponível
  }
}

export function clearPersistedSession() {
  removeStorage(SESSION_KEY)
  removeStorage(LAST_CONVERSATION_KEY)
}

export function loadLastConversationId(): string | null {
  return readStorage(LAST_CONVERSATION_KEY)
}

export function saveLastConversationId(id: string | null) {
  try {
    if (id) writeStorage(LAST_CONVERSATION_KEY, id)
    else removeStorage(LAST_CONVERSATION_KEY)
  } catch {
    // ignore
  }
}
