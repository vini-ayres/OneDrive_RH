import React, { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { Send, Mic, Paperclip, AlertCircle, Lock } from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import { useApp } from '../../contexts/AppContext'
import { hasPermission } from '../../utils/rbac'

const EXAMPLE_QUERIES = [
  "Localize o contrato de trabalho de João Silva",
  "Mostre os documentos admissionais do último mês",
  "Resuma o regulamento interno da empresa",
  "Liste os arquivos da pasta RH do SharePoint",
  "Quais documentos foram modificados esta semana?",
]

export function ChatInput() {
  const [input, setInput] = useState('')
  const [charCount, setCharCount] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, isProcessing } = useChat()
  const { state } = useApp()
  const { user } = state

  const MAX_CHARS = 2000
  const canSend = input.trim().length > 0 && !isProcessing && charCount <= MAX_CHARS

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= MAX_CHARS) {
      setInput(value)
      setCharCount(value.length)
      adjustTextareaHeight()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isProcessing) return

    setInput('')
    setCharCount(0)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    await sendMessage(trimmed)
  }

  const handleExampleClick = (query: string) => {
    setInput(query)
    setCharCount(query.length)
    textareaRef.current?.focus()
    adjustTextareaHeight()
  }

  const isNearLimit = charCount > MAX_CHARS * 0.85
  const isAtLimit = charCount >= MAX_CHARS

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
      {/* Examples - shown when no messages */}
      {state.currentConversation?.messages.length === 0 || !state.currentConversation ? (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-3xl mx-auto">
          {EXAMPLE_QUERIES.slice(0, 4).map((query, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(query)}
              className="text-left text-xs px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] hover:border-blue-300 dark:hover:border-blue-700 transition-all truncate"
            >
              {query}
            </button>
          ))}
        </div>
      ) : null}

      {/* Input area */}
      <div className="max-w-3xl mx-auto">
        <div className={`relative flex items-end gap-2 p-3 bg-[var(--bg-secondary)] border rounded-2xl transition-all ${
          isAtLimit 
            ? 'border-red-400 dark:border-red-600' 
            : 'border-[var(--border-color)] focus-within:border-blue-400 dark:focus-within:border-blue-600'
        }`}>
          {/* Attachment button */}
          <button
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0 self-end mb-0.5"
            title="Anexar arquivo (em breve)"
            disabled
          >
            <Paperclip size={17} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma consulta sobre documentos corporativos..."
            disabled={isProcessing}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] min-h-[24px] max-h-[200px] leading-6 py-0.5 disabled:opacity-50"
            aria-label="Campo de consulta"
            style={{ scrollbarWidth: 'none' }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`p-2 rounded-xl transition-all flex-shrink-0 self-end ${
              canSend
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
            aria-label="Enviar consulta"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Lock size={9} />
              Dados protegidos por LGPD
            </span>
            <span>Enter para enviar • Shift+Enter para nova linha</span>
          </div>

          {/* Character count */}
          {charCount > 0 && (
            <span className={`text-[10px] font-mono ${
              isAtLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-[var(--text-muted)]'
            }`}>
              {charCount}/{MAX_CHARS}
            </span>
          )}
        </div>

        {/* Warning message */}
        {isAtLimit && (
          <div className="flex items-center gap-1.5 mt-1 px-1 text-xs text-red-500">
            <AlertCircle size={12} />
            <span>Limite de caracteres atingido</span>
          </div>
        )}

        {/* Processing status */}
        {isProcessing && (
          <div className="mt-2 px-1 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Consultando OneDrive e SharePoint...</span>
          </div>
        )}

        {/* Permission warning */}
        {user && !hasPermission(user, 'canViewHolerites') && (
          <p className="text-[10px] text-[var(--text-muted)] mt-1 px-1 flex items-center gap-1">
            <AlertCircle size={9} />
            Consultas restritas ao seu perfil de acesso. Documentos confidenciais podem ser bloqueados.
          </p>
        )}
      </div>
    </div>
  )
}
