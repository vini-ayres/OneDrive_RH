import { useCallback, useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { sendChatMessage, uploadFileToOneDrive, logAuditEventLocal } from '../services/apiService'
import { sanitizeChatQuery, sanitizeApiResponse, generateSessionId } from '../utils/security'
import { checkQueryPermission } from '../utils/rbac'
import { extractFolderPathFromPrompt, validateUploadFile } from '../utils/uploadHelpers'
import { ChatMessage, ProcessingStep, DocumentSource } from '../types'
import { NEW_CONVERSATION_TITLE } from '../utils/conversation'
import { useQueryClient } from '@tanstack/react-query'

export function useChat() {
  const { state, dispatch, sessionId, newConversation } = useApp()
  const queryClient = useQueryClient()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])

  const updateStep = useCallback((id: string, updates: Partial<ProcessingStep>) => {
    setProcessingSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

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

    // Registrar tentativa de auditoria
    logAuditEventLocal({
      userId: user.id,
      userName: user.displayName,
      userEmail: user.email,
      action: file ? 'file_upload' : 'chat_query',
      query: safe || query,
      documentPath: folderPath || undefined,
      documentAccessed: file?.name,
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
    const steps: ProcessingStep[] = file
      ? [
          { id: 'auth', label: 'Verificando autenticação...', status: 'done', timestamp: new Date() },
          { id: 'prepare', label: 'Preparando arquivo para envio...', status: 'running' },
          { id: 'upload', label: 'Enviando para o OneDrive...', status: 'pending' },
          { id: 'confirm', label: 'Confirmando upload...', status: 'pending' },
        ]
      : [
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
      if (file && folderPath) {
        updateStep('prepare', { status: 'done', timestamp: new Date() })
        updateStep('upload', { status: 'running' })

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
          accessToken: user.accessToken,
          metadata: {
            ipAddress: 'browser',
            userAgent: navigator.userAgent,
            sessionId,
            timestamp: new Date().toISOString(),
          },
        })

        updateStep('upload', { status: 'done', timestamp: new Date() })
        updateStep('confirm', { status: 'running' })
        await new Promise(resolve => setTimeout(resolve, 200))
        updateStep('confirm', { status: 'done', timestamp: new Date() })

        if (!response.success || !response.data) {
          throw new Error(response.error || response.message || 'Erro no upload do arquivo')
        }

        const uploaded = response.data
        const answer = (uploaded.answer || uploaded.message || '').trim()

        if (!answer) {
          throw new Error('O webhook de upload não retornou uma mensagem de resposta.')
        }

        // Extrai links markdown da resposta do n8n para a seção de fontes
        const linkMatches = [...answer.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)]
        const sources = linkMatches.map(match => ({
          id: '',
          name: match[1],
          path: uploaded.file?.path || folderPath,
          modifiedAt: new Date(),
          webUrl: match[2],
          type: file.type || 'file',
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
      } else {
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
      if (file) {
        updateStep('prepare', { status: 'error' })
        updateStep('upload', { status: 'error' })
        updateStep('confirm', { status: 'error' })
      } else {
        updateStep('search', { status: 'error' })
        updateStep('analyze', { status: 'error' })
        updateStep('generate', { status: 'error' })
      }

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
    } finally {
      setIsProcessing(false)
      setProcessingSteps([])
    }
  }, [state, isProcessing, dispatch, sessionId, newConversation, updateStep, queryClient])

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
    path: source.path.replace(/\/drives\/[^/]+\/items\/[^/]+/g, ''),
  }))
}
