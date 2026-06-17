import { useCallback, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { sendChatMessage, logAuditEventLocal } from '../services/apiService'
import { sanitizeChatQuery, sanitizeApiResponse, generateSessionId } from '../utils/security'
import { checkQueryPermission } from '../utils/rbac'
import { ChatMessage, ProcessingStep, DocumentSource } from '../types'

export function useChat() {
  const { state, dispatch, sessionId, newConversation } = useApp()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])

  const updateStep = useCallback((id: string, updates: Partial<ProcessingStep>) => {
    setProcessingSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  const sendMessage = useCallback(async (query: string) => {
    const { user } = state
    if (!user || isProcessing) return

    // Garantir que há uma conversa ativa
    let conversation = state.currentConversation
    if (!conversation) {
      conversation = newConversation()
    }

    // === SEGURANÇA: Sanitizar input ===
    const { safe, blocked, reason } = sanitizeChatQuery(query)

    // === RBAC: Verificar permissões ===
    const permissionDenied = !blocked ? checkQueryPermission(safe, user) : null

    const messageId = generateSessionId()
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: safe || query,
      timestamp: new Date(),
      status: blocked ? 'blocked' : 'sending',
    }

    dispatch({
      type: 'ADD_MESSAGE',
      payload: { conversationId: conversation.id, message: userMessage }
    })

    // Registrar tentativa de auditoria
    logAuditEventLocal({
      userId: user.id,
      userName: user.displayName,
      userEmail: user.email,
      action: 'chat_query',
      query: safe || query,
      result: blocked || permissionDenied ? 'blocked' : 'success',
      ipAddress: 'browser',
      userAgent: navigator.userAgent,
      sessionId,
      role: user.roles[0] || 'colaborador',
    })

    // Se bloqueado ou sem permissão
    if (blocked || permissionDenied) {
      const errorMessage: ChatMessage = {
        id: generateSessionId(),
        role: 'assistant',
        content: permissionDenied || reason || 'Sua consulta foi bloqueada por questões de segurança.',
        timestamp: new Date(),
        status: 'blocked',
      }
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { conversationId: conversation.id, message: errorMessage }
      })
      return
    }

    // === Iniciar indicadores de processamento ===
    setIsProcessing(true)
    const steps: ProcessingStep[] = [
      { id: 'auth', label: 'Verificando autenticação...', status: 'done', timestamp: new Date() },
      { id: 'search', label: 'Consultando OneDrive/SharePoint...', status: 'running' },
      { id: 'analyze', label: 'Analisando documentos...', status: 'pending' },
      { id: 'generate', label: 'Gerando resposta...', status: 'pending' },
    ]
    setProcessingSteps(steps)

    // Mensagem de loading do assistente
    const loadingMsgId = generateSessionId()
    const loadingMessage: ChatMessage = {
      id: loadingMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'sending',
      processingSteps: steps,
    }
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { conversationId: conversation.id, message: loadingMessage }
    })

    try {
      // Simular progresso das etapas
      await new Promise(resolve => setTimeout(resolve, 800))
      updateStep('search', { status: 'done', timestamp: new Date() })
      updateStep('analyze', { status: 'running' })

      // Chamar API n8n
      const response = await sendChatMessage({
        query: safe,
        userId: user.id,
        userName: user.displayName,
        userEmail: user.email,
        userGroups: user.groups,
        userRoles: user.roles,
        conversationId: conversation.id,
        accessToken: user.accessToken,
        metadata: {
          ipAddress: 'browser',
          userAgent: navigator.userAgent,
          sessionId,
          timestamp: new Date().toISOString(),
        },
      })

      updateStep('analyze', { status: 'done', timestamp: new Date() })
      updateStep('generate', { status: 'running' })
      await new Promise(resolve => setTimeout(resolve, 400))
      updateStep('generate', { status: 'done', timestamp: new Date() })

      if (response.success && response.data) {
        const { answer, sources, wasBlocked, blockedReason } = response.data

        // Sanitizar resposta da API (remover IDs técnicos)
        const sanitizedAnswer = sanitizeApiResponse(answer)

        const assistantMessage: ChatMessage = {
          id: generateSessionId(),
          role: 'assistant',
          content: wasBlocked ? (blockedReason || 'Acesso bloqueado.') : sanitizedAnswer,
          timestamp: new Date(),
          status: wasBlocked ? 'blocked' : 'sent',
          sources: wasBlocked ? [] : sanitizeSources(sources),
        }

        // Remover mensagem de loading e adicionar resposta real
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: conversation.id,
            messageId: loadingMsgId,
            updates: assistantMessage,
          }
        })

        // Atualizar título da conversa com base na primeira mensagem
        if (conversation.messages.length <= 2) {
          const title = safe.length > 50 ? safe.substring(0, 50) + '...' : safe
          dispatch({
            type: 'UPDATE_CONVERSATION',
            payload: { ...conversation, title }
          })
        }
      } else {
        throw new Error(response.error || 'Erro na resposta da API')
      }

    } catch (error: unknown) {
      updateStep('search', { status: 'error' })
      updateStep('analyze', { status: 'error' })
      updateStep('generate', { status: 'error' })

      const err = error as Error
      let errorContent = 'Ocorreu um erro ao processar sua consulta. Por favor, tente novamente.'

      if (err.message === 'REQUEST_TIMEOUT') {
        errorContent = 'A consulta demorou muito para ser processada. Por favor, tente novamente.'
      } else if (err.message === 'UNAUTHORIZED') {
        errorContent = 'Sua sessão expirou. Por favor, faça login novamente.'
      } else if (err.message === 'FORBIDDEN') {
        errorContent = 'Você não tem permissão para realizar esta consulta.'
      }

      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          conversationId: conversation.id,
          messageId: loadingMsgId,
          updates: {
            content: errorContent,
            status: 'error',
          }
        }
      })
    } finally {
      setIsProcessing(false)
      setProcessingSteps([])
    }
  }, [state, isProcessing, dispatch, sessionId, newConversation, updateStep])

  return {
    sendMessage,
    isProcessing,
    processingSteps,
  }
}

/**
 * Remove informações técnicas das fontes antes de exibir ao usuário
 */
function sanitizeSources(sources: DocumentSource[]): DocumentSource[] {
  return sources.map(source => ({
    ...source,
    id: '', // Nunca expor IDs internos
    path: source.path.replace(/\/drives\/[^/]+\/items\/[^/]+/g, ''), // Remover paths técnicos
  }))
}
