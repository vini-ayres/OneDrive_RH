import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { AppState, UserProfile, Conversation, ChatMessage } from '../types'
import { generateSessionId } from '../utils/security'

type AppAction =
  | { type: 'SET_USER'; payload: UserProfile | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'SET_VIEW'; payload: AppState['activeView'] }
  | { type: 'SET_CONVERSATION'; payload: Conversation | null }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: Conversation }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: ChatMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; messageId: string; updates: Partial<ChatMessage> } }
  | { type: 'SET_SESSION_EXPIRES'; payload: Date | null }
  | { type: 'UPDATE_ACTIVITY' }
  | { type: 'LOGOUT' }

const SESSION_TIMEOUT_MINUTES = 30
const SESSION_ID = generateSessionId()

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  currentConversation: null,
  conversations: [],
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  sidebarOpen: true,
  activeView: 'chat',
  sessionExpiresAt: null,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        sessionExpiresAt: action.payload
          ? new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000)
          : null,
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

    case 'SET_CONVERSATION':
      return { ...state, currentConversation: action.payload }

    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        currentConversation: action.payload,
      }

    case 'UPDATE_CONVERSATION': {
      const updated = state.conversations.map(c => {
        if (c.id !== action.payload.id) return c

        return {
          ...c,
          ...action.payload,
          // Nunca perder mensagens já renderizadas quando o update vier com um objeto parcial
          messages: action.payload.messages.length > 0 ? action.payload.messages : c.messages,
          createdAt: action.payload.createdAt || c.createdAt,
          updatedAt: action.payload.updatedAt || c.updatedAt,
        }
      })
      const currentConversation =
        state.currentConversation?.id === action.payload.id
          ? updated.find(c => c.id === action.payload.id) || state.currentConversation
          : state.currentConversation

      return {
        ...state,
        conversations: updated,
        currentConversation,
      }
    }

    case 'DELETE_CONVERSATION': {
      const filtered = state.conversations.filter(c => c.id !== action.payload)
      return {
        ...state,
        conversations: filtered,
        currentConversation:
          state.currentConversation?.id === action.payload
            ? filtered[0] || null
            : state.currentConversation,
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

    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        sessionExpiresAt: new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000),
        user: state.user
          ? { ...state.user, lastActivity: new Date() }
          : null,
      }

    case 'LOGOUT':
      return {
        ...initialState,
        theme: state.theme,
        isLoading: false,
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

  // Aplicar tema salvo na inicialização
  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

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
      title: 'Nova Conversa',
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
