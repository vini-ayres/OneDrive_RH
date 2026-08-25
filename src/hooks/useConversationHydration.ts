import { useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { useConversationHistory } from './useDataApi'
import { useActiveConversationSync } from './useActiveConversation'

/**
 * Hidrata a lista de conversas do backend após login
 * e carrega as mensagens da conversa aberta.
 */
export function useConversationHydration() {
  const { state, dispatch } = useApp()
  const { data, isSuccess } = useConversationHistory()
  useActiveConversationSync()

  useEffect(() => {
    if (!state.isAuthenticated || !isSuccess || !data) return
    dispatch({ type: 'SET_CONVERSATIONS', payload: data })
  }, [state.isAuthenticated, isSuccess, data, dispatch])
}
