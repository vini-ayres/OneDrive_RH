import { useEffect, useRef } from 'react'
import { useApp } from '../contexts/AppContext'
import { getConversationMessages } from '../services/apiService'
import { mapApiConversation } from '../utils/conversation'

/**
 * Carrega as mensagens da conversa ativa a partir da API,
 * no mesmo modelo do ChatGPT: clicar no histórico abre o thread completo.
 */
export function useActiveConversationSync() {
  const { state, dispatch } = useApp()
  const conversationId = state.currentConversation?.id ?? null
  const userId = state.user?.id
  const reloadAt = state.conversationReloadAt
  const requestIdRef = useRef(0)
  const userRef = useRef(state.user)
  const conversationRef = useRef(state.currentConversation)
  userRef.current = state.user
  conversationRef.current = state.currentConversation

  useEffect(() => {
    const activeUser = userRef.current
    const current = conversationRef.current
    if (!activeUser || !conversationId || !current || current.id !== conversationId) {
      dispatch({ type: 'SET_CONVERSATION_STATUS', payload: { loadingId: null, error: null } })
      return
    }

    if (current.messages.some(m => m.status === 'sending')) return

    const isDraft =
      current.messages.length === 0 &&
      (current.title === 'Nova conversa' || current.title === 'Nova Conversa')
    if (isDraft) {
      dispatch({ type: 'SET_CONVERSATION_STATUS', payload: { loadingId: null, error: null } })
      return
    }

    const requestId = ++requestIdRef.current
    const showSpinner = current.messages.length === 0
    if (showSpinner) {
      dispatch({ type: 'SET_CONVERSATION_STATUS', payload: { loadingId: conversationId, error: null } })
    }

    getConversationMessages(activeUser, conversationId)
      .then(response => {
        if (requestId !== requestIdRef.current) return

        if (response.success && response.data) {
          const mapped = mapApiConversation(
            response.data.conversation,
            response.data.messages,
            current
          )
          const localCount = current.messages.filter(m => m.status !== 'sending').length
          dispatch({
            type: 'UPDATE_CONVERSATION',
            payload: mapped.messages.length >= localCount
              ? mapped
              : { ...mapped, messages: [] },
          })
          dispatch({ type: 'SET_CONVERSATION_STATUS', payload: { loadingId: null, error: null } })
          return
        }

        dispatch({
          type: 'SET_CONVERSATION_STATUS',
          payload: {
            loadingId: null,
            error: current.messages.length > 0
              ? null
              : response.error === 'NOT_FOUND'
                ? 'Esta conversa não foi encontrada no servidor.'
                : 'Não foi possível carregar esta conversa.',
          },
        })
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return
        dispatch({
          type: 'SET_CONVERSATION_STATUS',
          payload: {
            loadingId: null,
            error: current.messages.length > 0 ? null : 'Não foi possível carregar esta conversa.',
          },
        })
      })

    return () => {
      requestIdRef.current += 1
    }
  }, [conversationId, userId, dispatch, reloadAt])
}
