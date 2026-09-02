import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { AppState, UserProfile, Conversation, ChatMessage } from '../types'
import { generateSessionId } from '../utils/security'
import { isEmptyDraftConversation, NEW_CONVERSATION_TITLE } from '../utils/conversation'
import {
  clearPersistedSession,
  loadLastConversationId,
  loadPersistedSession,
  saveLastConversationId,
  savePersistedSession,
  SESSION_KEY,
} from '../utils/sessionPersistence'

type AppAction =
  | { type: 'SET_USER'; payload: UserProfile | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'SET_VIEW'; payload: AppState['activeView'] }
  | { type: 'SET_CONVERSATION'; payload: Conversation | null }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: Conversation }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageId: string; updates: Partial<ChatMessage> } }
  | { type: 'SET_SESSION_EXPIRES'; payload: Date | null }
  | { type: 'SET_CONVERSATION_STATUS'; payload: { loadingId: string | null; error: string | null } }
  | { type: 'RELOAD_CONVERSATION' }
  | { type: 'UPDATE_ACTIVITY' }
  | { type: 'HYDRATE_SESSION'; payload: { user: UserProfile; sessionExpiresAt: Date } }
  | { type: 'LOGOUT' }

const SESSION_TIMEOUT_MINUTES = 30
const SESSION_ID = generateSessionId()

const persistedSession = loadPersistedSession()

const initialState: AppState = {
  user: persistedSession?.user ?? null,
  isAuthenticated: Boolean(persistedSession?.user),
  isLoading: true,
  currentConversation: null,
  conversations: [],
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  sidebarOpen: true,
  activeView: 'chat',
  sessionExpiresAt: persistedSession?.sessionExpiresAt ?? null,
  conversationLoadingId: null,
  conversationLoadError: null,
  conversationReloadAt: 0,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER': {
      const next = {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        sessionExpiresAt: action.payload
          ? new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000)
          : null,
      }
      if (next.user && next.sessionExpiresAt) {
        savePersistedSession(next.user, next.sessionExpiresAt)
      } else {
        clearPersistedSession()
      }
      return next
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_THEME':
      localStorage.setItem('theme', action.payload)
      if (action.payload === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return { ...state, theme: action.payload }

    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload }

    case 'SET_VIEW':
      return { ...state, activeView: action.payload }

    case 'SET_CONVERSATION': {
      const next = action.payload
      const conversations = state.conversations.filter(
        c => c.id === next?.id || !isEmptyDraftConversation(c)
      )
      saveLastConversationId(next?.id ?? null)
      return {
        ...state,
        currentConversation: next
          ? conversations.find(c => c.id === next.id) || next
          : null,
        conversations,
        conversationLoadError: next?.id === state.currentConversation?.id
          ? state.conversationLoadError
          : null,
      }
    }

    case 'SET_CONVERSATION_STATUS':
      return {
        ...state,
        conversationLoadingId: action.payload.loadingId,
        conversationLoadError: action.payload.error,
      }

    case 'RELOAD_CONVERSATION':
      return {
        ...state,
        conversationReloadAt: Date.now(),
        conversationLoadError: null,
      }

    case 'SET_CONVERSATIONS': {
      const existingById = new Map(state.conversations.map(c => [c.id, c]))
      const fromServer = action.payload.map(incoming => {
        const existing = existingById.get(incoming.id)
        if (existing && existing.messages.length > 0) {
          return {
            ...incoming,
            messages: existing.messages,
            createdAt: existing.createdAt || incoming.createdAt,
          }
        }
        return incoming
      })
      const incomingIds = new Set(action.payload.map(c => c.id))
      const localOnly = state.conversations.filter(
        c => !incomingIds.has(c.id) && (c.messages.length > 0 || c.id === state.currentConversation?.id)
      )
      const merged = [...localOnly, ...fromServer].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      )
      const lastId = state.currentConversation?.id || loadLastConversationId()
      const currentConversation = lastId
        ? merged.find(c => c.id === lastId) || state.currentConversation
        : null
      if (currentConversation?.id) {
        saveLastConversationId(currentConversation.id)
      }
      return {
        ...state,
        conversations: merged,
        currentConversation,
      }
    }

    case 'ADD_CONVERSATION':
      saveLastConversationId(action.payload.id)
      return {
        ...state,
        conversations: [
          action.payload,
          ...state.conversations.filter(c => !isEmptyDraftConversation(c)),
        ],
        currentConversation: action.payload,
        conversationLoadingId: null,
        conversationLoadError: null,
      }

    case 'UPDATE_CONVERSATION': {
      const exists = state.conversations.some(c => c.id === action.payload.id)
      const updated = exists
        ? state.conversations.map(c => {
            if (c.id !== action.payload.id) return c

            return {
              ...c,
              ...action.payload,
              messages: action.payload.messages.length > 0 ? action.payload.messages : c.messages,
              createdAt: action.payload.createdAt || c.createdAt,
              updatedAt: action.payload.updatedAt || c.updatedAt,
            }
          })
        : [action.payload, ...state.conversations]
      const currentConversation =
        state.currentConversation?.id === action.payload.id
          ? updated.find(c => c.id === action.payload.id) || action.payload
          : state.currentConversation

      return {
        ...state,
        conversations: updated,
        currentConversation,
      }
    }

    case 'DELETE_CONVERSATION': {
      const filtered = state.conversations.filter(c => c.id !== action.payload)
      const currentConversation =
        state.currentConversation?.id === action.payload
          ? null
          : state.currentConversation
      saveLastConversationId(currentConversation?.id ?? null)
      return {
        ...state,
        conversations: filtered,
        currentConversation,
      }
    }

    case 'ADD_MESSAGE': {
      const conv = state.conversations.find(c => c.id === action.payload.conversationId)
      if (!conv) return state

      const updated = {
        ...conv,
        messages: [...conv.messages, action.payload.message],
        updatedAt: new Date(),
      }

      return appReducer(state, { type: 'UPDATE_CONVERSATION', payload: updated })
    }

    case 'UPDATE_MESSAGE': {
      const conv = state.conversations.find(c => c.id === action.payload.conversationId)
      if (!conv) return state

      const updated = {
        ...conv,
        messages: conv.messages.map(m =>
          m.id === action.payload.messageId
            ? { ...m, ...action.payload.updates }
            : m
        ),
      }

      return appReducer(state, { type: 'UPDATE_CONVERSATION', payload: updated })
    }

    case 'SET_SESSION_EXPIRES':
      return { ...state, sessionExpiresAt: action.payload }

    case 'UPDATE_ACTIVITY': {
      const sessionExpiresAt = new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000)
      const user = state.user
        ? { ...state.user, lastActivity: new Date() }
        : null
      if (user) {
        savePersistedSession(user, sessionExpiresAt)
      }
      return {
        ...state,
        sessionExpiresAt,
        user,
      }
    }

    case 'HYDRATE_SESSION':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        sessionExpiresAt: action.payload.sessionExpiresAt,
      }

    case 'LOGOUT':
      clearPersistedSession()
      return {
        ...initialState,
        user: null,
        isAuthenticated: false,
        theme: state.theme,
        isLoading: false,
        conversationLoadingId: null,
        conversationLoadError: null,
        currentConversation: null,
        conversations: [],
        sessionExpiresAt: null,
      }

    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  sessionId: string
  newConversation: () => Conversation
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const activityTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const userRef = useRef(state.user)
  userRef.current = state.user

  // Aplicar tema salvo na inicialização
  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Sincroniza login/logout entre abas via localStorage
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY) return

      if (!event.newValue) {
        if (userRef.current) {
          dispatch({ type: 'LOGOUT' })
        }
        return
      }

      if (userRef.current) return

      const session = loadPersistedSession()
      if (session) {
        dispatch({
          type: 'HYDRATE_SESSION',
          payload: {
            user: session.user,
            sessionExpiresAt: session.sessionExpiresAt,
          },
        })
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [dispatch])

  // Monitor de inatividade - timeout de sessão
  const resetActivityTimer = useCallback(() => {
    if (!state.isAuthenticated) return

    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current)
    }

    dispatch({ type: 'UPDATE_ACTIVITY' })

    activityTimerRef.current = setTimeout(() => {
      // Sessão expirada por inatividade
      dispatch({ type: 'LOGOUT' })
    }, SESSION_TIMEOUT_MINUTES * 60 * 1000)
  }, [state.isAuthenticated])

  // Registrar eventos de atividade
  useEffect(() => {
    if (!state.isAuthenticated) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => resetActivityTimer()

    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))
    resetActivityTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity))
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current)
      }
    }
  }, [state.isAuthenticated, resetActivityTimer])

  const newConversation = useCallback((): Conversation => {
    const conv: Conversation = {
      id: generateSessionId(),
      title: NEW_CONVERSATION_TITLE,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isFavorite: false,
      userId: state.user?.id || '',
    }
    dispatch({ type: 'ADD_CONVERSATION', payload: conv })
    return conv
  }, [state.user])

  return (
    <AppContext.Provider value={{ state, dispatch, sessionId: SESSION_ID, newConversation }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider')
  return ctx
}

export { SESSION_TIMEOUT_MINUTES }
