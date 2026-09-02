import React, { useState } from 'react'
import { ChatMessage } from '../../types'
import { TypingIndicator } from './TypingIndicator'
import { Avatar } from '../ui/Avatar'
import { useApp } from '../../contexts/AppContext'
import { 
  Bot, Copy, ThumbsUp, ThumbsDown, ExternalLink, 
  FileText, Calendar, AlertTriangle, CheckCircle, X, Paperclip
} from 'lucide-react'
import { formatFileSize } from '../../utils/uploadHelpers'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { isSecureUrl } from '../../utils/security'
import { formatChatMarkdown } from '../../utils/chatMarkdown'
import { recordDocumentAccess } from '../../services/apiService'
import { useQueryClient } from '@tanstack/react-query'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { state } = useApp()
  const { user } = state
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  const isUser = message.role === 'user'
  const isLoading = message.status === 'sending' && !isUser
  const isBlocked = message.status === 'blocked'
  const isError = message.status === 'error'

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTimestamp = (date: Date) => {
    return format(date, "HH:mm 'às' dd/MM/yyyy", { locale: ptBR })
  }

  const handleDocumentOpen = (source: NonNullable<ChatMessage['sources']>[0]) => {
    if (!user) return
    const documentId = source.id || source.webUrl || source.name
    if (!documentId) return
    recordDocumentAccess(user, documentId, {
      name: source.name,
      path: source.path,
      webUrl: source.webUrl,
      docType: source.type,
      source: 'chat_source',
    })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['recent-documents'] })
      })
      .catch(() => {
        // Falha silenciosa — não bloqueia abertura do link
      })
  }

  // Formatar conteúdo markdown retornado pelo n8n (links, listas, negrito, etc.)
  const formatContent = (text: string) => formatChatMarkdown(text)

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-2 animate-fade-in">
        <div className="max-w-[80%]">
          <div className="message-user">
            {message.attachment && (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20">
                <Paperclip size={13} className="flex-shrink-0 opacity-90" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{message.attachment.name}</p>
                  <p className="text-[10px] opacity-80">
                    {formatFileSize(message.attachment.size)}
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] text-right mt-1 pr-1">
            {formatTimestamp(message.timestamp)}
          </p>
        </div>
        {user && (
          <Avatar src={user.photoUrl} name={user.displayName} size="sm" className="mb-5 flex-shrink-0" />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* Assistant avatar */}
      <div
        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5"
        title="Assistente"
      >
        <Bot size={16} className="text-white" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0 max-w-[85%]">
        {/* Message bubble */}
        <div className={`message-assistant ${
          isBlocked ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : ''
        } ${
          isError ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10' : ''
        }`}>
          {/* Status indicator */}
          {isBlocked && (
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-2 text-xs font-medium">
              <AlertTriangle size={13} />
              <span>Acesso Bloqueado</span>
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 mb-2 text-xs font-medium">
              <AlertTriangle size={13} />
              <span>Erro no Processamento</span>
            </div>
          )}

          {/* Loading state */}
          {isLoading ? (
            <TypingIndicator steps={message.processingSteps} />
          ) : (
            <div
              className="text-sm leading-relaxed text-[var(--text-primary)] prose-custom"
              dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
            />
          )}
        </div>

        {/* Sources */}
        {!isLoading && message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1">
              <FileText size={11} />
              Fontes utilizadas:
            </p>
            <div className="space-y-1">
              {message.sources.map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <FileText size={13} className="text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {source.name}
                    </p>
                    {source.modifiedAt && (
                      <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                        <Calendar size={9} />
                        Modificado em {format(new Date(source.modifiedAt), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    )}
                    {source.excerpt && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {source.excerpt}
                      </p>
                    )}
                  </div>
                  {source.webUrl && isSecureUrl(source.webUrl) && (
                    <a
                      href={source.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                      title="Abrir documento"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDocumentOpen(source)
                      }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message footer - actions */}
        {!isLoading && !isBlocked && !isError && message.content && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatTimestamp(message.timestamp)}
            </span>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={copyToClipboard}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Copiar resposta"
              >
                {copied ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
              </button>
              <button
                onClick={() => setFeedback('up')}
                className={`p-1 rounded transition-colors ${
                  feedback === 'up' 
                    ? 'text-green-500' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
                title="Resposta útil"
              >
                <ThumbsUp size={13} />
              </button>
              <button
                onClick={() => setFeedback('down')}
                className={`p-1 rounded transition-colors ${
                  feedback === 'down'
                    ? 'text-red-500'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
                title="Resposta não útil"
              >
                <ThumbsDown size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Blocked message footer */}
        {isBlocked && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-red-500 dark:text-red-400">
            <X size={10} />
            <span>Esta consulta foi bloqueada pelo sistema de controle de acesso (RBAC)</span>
          </div>
        )}
      </div>
    </div>
  )
}
