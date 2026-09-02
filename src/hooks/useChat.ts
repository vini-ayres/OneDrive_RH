import { useCallback, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { sendChatMessage, uploadFileToOneDrive, recordAiQueryOutcome } from '../services/apiService'
import { sanitizeChatQuery, sanitizeApiResponse, generateSessionId } from '../utils/security'
import { checkQueryPermission } from '../utils/rbac'
import { extractFolderPathFromPrompt, validateUploadFile } from '../utils/uploadHelpers'
import { ChatMessage, ProcessingStep, DocumentSource } from '../types'
import { extractMarkdownSources, NEW_CONVERSATION_TITLE } from '../utils/conversation'
import { useQueryClient } from '@tanstack/react-query'
import {
  CHAT_PROCESSING_TIMELINE,
  UPLOAD_PROCESSING_TIMELINE,
  completeTimeline,
  failTimeline,
  serializeSteps,
  stepsForElapsed,
} from '../utils/processingTimeline'

export function useChat() {
  const { state, dispatch, sessionId, newConversation } = useApp()
  const queryClient = useQueryClient()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])

  const sendMessage = useCallback(async (query: string, file?: File | null) => {
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

    // Validação de upload (arquivo + pasta no prompt)
    let folderPath: string | null = null
    if (file) {
      const fileCheck = validateUploadFile(file)
      if (!fileCheck.ok) {
        const errorMessage: ChatMessage = {
          id: generateSessionId(),
          role: 'assistant',
          content: fileCheck.reason,
          timestamp: new Date(),
          status: 'error',
        }
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            conversationId: conversation.id,
            message: {
              id: generateSessionId(),
              role: 'user',
              content: safe || query,
              timestamp: new Date(),
              status: 'sent',
              attachment: { name: file.name, size: file.size, type: file.type },
            },
          },
        })
        dispatch({
          type: 'ADD_MESSAGE',
          payload: { conversationId: conversation.id, message: errorMessage },
        })
        return
      }

      folderPath = extractFolderPathFromPrompt(safe || query)
      if (!folderPath) {
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            conversationId: conversation.id,
            message: {
              id: generateSessionId(),
              role: 'user',
              content: safe || query,
              timestamp: new Date(),
              status: 'sent',
              attachment: { name: file.name, size: file.size, type: file.type },
            },
          },
        })
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            conversationId: conversation.id,
            message: {
              id: generateSessionId(),
              role: 'assistant',
              content:
                'Para enviar o arquivo, especifique a pasta do OneDrive no prompt. Exemplos:\n\n' +
                '- `Envie este arquivo para a pasta /RH/Uploads`\n' +
                '- `Salve na pasta RH/Documentos/Contratos`\n' +
                '- `pasta: /RH/Temp`',
              timestamp: new Date(),
              status: 'error',
            },
          },
        })
        return
      }
    }

    const requestId = generateSessionId()
    const promptSentAt = new Date().toISOString()
    const messageId = generateSessionId()
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: safe || query,
      timestamp: new Date(),
      status: blocked ? 'blocked' : 'sending',
      attachment: file
        ? {
            name: file.name,
            size: file.size,
            type: file.type,
            folderPath: folderPath || undefined,
          }
        : undefined,
    }

    dispatch({
      type: 'ADD_MESSAGE',
      payload: { conversationId: conversation.id, message: userMessage }
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

    // === Indicadores de processamento (avançam com o tempo) ===
    setIsProcessing(true)
    const timeline = file ? UPLOAD_PROCESSING_TIMELINE : CHAT_PROCESSING_TIMELINE
    const steps = stepsForElapsed(timeline, 0)
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

    const reportOutcome = (
      result: 'success' | 'error',
      processingMs?: number,
      errorMessage?: string,
      outcomeRequestId?: string
    ) => {
      void recordAiQueryOutcome(user, {
        requestId: outcomeRequestId || requestId,
        conversationId: conversation.id,
        sessionId,
        action: file ? 'file_upload' : 'chat_query',
        result,
        query: safe || query,
        processingMs,
        errorMessage,
        documentAccessed: file?.name,
        documentPath: folderPath || undefined,
      })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    }

    let lastStepKey = serializeSteps(steps)
    const publishSteps = (next: ProcessingStep[]) => {
      const key = serializeSteps(next)
      if (key === lastStepKey) return
      lastStepKey = key
      setProcessingSteps(next)
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          conversationId: conversation.id,
          messageId: loadingMsgId,
          updates: { processingSteps: next },
        },
      })
    }

    const startedAt = Date.now()
    const tickId = window.setInterval(() => {
      publishSteps(stepsForElapsed(timeline, Date.now() - startedAt))
    }, 200)

    const stopTicker = () => window.clearInterval(tickId)

    try {
      if (file && folderPath) {
        const response = await uploadFileToOneDrive({
          query: safe,
          folderPath,
          file,
          userId: user.id,
          userName: user.displayName,
          userEmail: user.email,
          userGroups: user.groups,
          userRoles: user.roles,
          conversationId: conversation.id,
          requestId,
          promptSentAt,
          accessToken: user.accessToken,
          metadata: {
            ipAddress: 'browser',
            userAgent: navigator.userAgent,
            sessionId,
            timestamp: promptSentAt,
          },
        })

        stopTicker()
        publishSteps(completeTimeline(timeline))
        await new Promise(resolve => setTimeout(resolve, 320))

        if (!response.success || !response.data) {
          throw new Error(response.error || response.message || 'Erro no upload do arquivo')
        }

        const uploaded = response.data
        const answer = (uploaded.answer || uploaded.message || '').trim()

        if (!answer) {
          throw new Error('O webhook de upload não retornou uma mensagem de resposta.')
        }

        const sources = extractMarkdownSources(answer).map(source => ({
          ...source,
          path: uploaded.file?.path || folderPath || source.path,
          type: file.type || source.type,
        }))

        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: {
            conversationId: conversation.id,
            messageId: loadingMsgId,
            updates: {
              id: generateSessionId(),
              role: 'assistant',
              content: sanitizeApiResponse(answer),
              timestamp: new Date(),
              status: 'sent',
              sources,
            },
          },
        })

        reportOutcome(
          'success',
          uploaded.processingTimeMs,
          undefined,
          uploaded.requestId || response.requestId || requestId
        )
      } else {
        const response = await sendChatMessage({
          query: safe,
          userId: user.id,
          userName: user.displayName,
          userEmail: user.email,
          userGroups: user.groups,
          userRoles: user.roles,
          conversationId: conversation.id,
          requestId,
          promptSentAt,
          accessToken: user.accessToken,
          metadata: {
            ipAddress: 'browser',
            userAgent: navigator.userAgent,
            sessionId,
            timestamp: promptSentAt,
          },
        })

        stopTicker()
        publishSteps(completeTimeline(timeline))
        await new Promise(resolve => setTimeout(resolve, 320))

        if (response.success && response.data) {
          const { answer, sources, wasBlocked, blockedReason } = response.data

          // Sanitizar resposta da API (remover IDs técnicos)
          const sanitizedAnswer = sanitizeApiResponse(answer)
          const resolvedSources = wasBlocked
            ? []
            : sanitizeSources(sources.length > 0 ? sources : extractMarkdownSources(sanitizedAnswer))

          const assistantMessage: ChatMessage = {
            id: generateSessionId(),
            role: 'assistant',
            content: wasBlocked ? (blockedReason || 'Acesso bloqueado.') : sanitizedAnswer,
            timestamp: new Date(),
            status: wasBlocked ? 'blocked' : 'sent',
            sources: resolvedSources,
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

          reportOutcome(
            'success',
            response.data.processingTimeMs,
            undefined,
            response.data.requestId || response.requestId || requestId
          )
        } else {
          throw new Error(response.error || 'Erro na resposta da API')
        }
      }

      // Atualizar título apenas na primeira mensagem (evita sobrescrever mensagens com snapshot stale)
      if (conversation.title === NEW_CONVERSATION_TITLE || conversation.title === 'Nova Conversa') {
        const titleBase = file ? `Upload: ${file.name}` : safe
        const title = titleBase.length > 50 ? titleBase.substring(0, 50) + '...' : titleBase
        dispatch({
          type: 'UPDATE_CONVERSATION',
          payload: {
            id: conversation.id,
            title,
            messages: [],
            createdAt: conversation.createdAt,
            updatedAt: new Date(),
            isFavorite: conversation.isFavorite,
            userId: conversation.userId,
          }
        })
      }

      void queryClient.invalidateQueries({ queryKey: ['conversations', user.id] })
      void queryClient.invalidateQueries({ queryKey: ['recent-documents'] })

    } catch (error: unknown) {
      stopTicker()
      publishSteps(failTimeline(stepsForElapsed(timeline, Date.now() - startedAt)))

      const err = error as Error
      let errorContent = file
        ? 'Ocorreu um erro ao enviar o arquivo. Por favor, tente novamente.'
        : 'Ocorreu um erro ao processar sua consulta. Por favor, tente novamente.'

      if (err.message === 'REQUEST_TIMEOUT') {
        errorContent = file
          ? 'O upload demorou muito para ser processado. Por favor, tente novamente.'
          : 'A consulta demorou muito para ser processada. Por favor, tente novamente.'
      } else if (err.message === 'UNAUTHORIZED') {
        errorContent = 'Sua sessão expirou. Por favor, faça login novamente.'
      } else if (err.message === 'FORBIDDEN') {
        errorContent = file
          ? 'Você não tem permissão para enviar arquivos para esta pasta.'
          : 'Você não tem permissão para realizar esta consulta.'
      } else if (/workflow execution failed|executando workflow|workflow falhou/i.test(err.message)) {
        errorContent = 'O workflow do n8n falhou ao processar a solicitação. Verifique a execução no painel do n8n.'
      } else if (err.message.startsWith('HTTP_ERROR_')) {
        errorContent = `Erro do servidor (${err.message.replace('HTTP_ERROR_', '')}). Tente novamente.`
      } else if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        errorContent = 'Não foi possível conectar ao backend n8n. Verifique a URL do webhook e a conexão de rede.'
      } else if (err.message && err.message !== 'Erro na resposta da API' && err.message !== 'Erro no upload do arquivo') {
        errorContent = err.message
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

      const timed = error as Error & { requestId?: string; processingTimeMs?: number }
      reportOutcome('error', timed.processingTimeMs, errorContent, timed.requestId || requestId)
    } finally {
      stopTicker()
      setIsProcessing(false)
      setProcessingSteps([])
    }
  }, [state, isProcessing, dispatch, sessionId, newConversation, queryClient])

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
    id: source.id || source.webUrl || source.name || '',
    path: (source.path || '').replace(/\/drives\/[^/]+\/items\/[^/]+/g, ''),
    webUrl: source.webUrl || '',
    name: source.name || source.webUrl || '',
    modifiedAt: source.modifiedAt ? new Date(source.modifiedAt) : new Date(),
  }))
}
