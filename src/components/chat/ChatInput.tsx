import React, { useState, useRef, useCallback, KeyboardEvent, useEffect } from 'react'
import { Send, Paperclip, AlertCircle, Lock, X, FileText } from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import { useApp } from '../../contexts/AppContext'
import { hasPermission } from '../../utils/rbac'
import {
  formatFileSize,
  releaseLocalFile,
  validateUploadFile,
  MAX_UPLOAD_BYTES,
} from '../../utils/uploadHelpers'

const EXAMPLE_QUERIES = [
  "Localize o contrato de trabalho de João Silva",
  "Mostre os documentos admissionais do último mês",
  "Resuma o regulamento interno da empresa",
  "Liste os arquivos da pasta RH do SharePoint",
  "Quais documentos foram modificados esta semana?",
]

interface ChatInputProps {
  /** Arquivo arrastado na área do chat (importação automática) */
  pendingFile?: File | null
  onPendingFileHandled?: () => void
}

export function ChatInput({ pendingFile = null, onPendingFileHandled }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sendingUpload, setSendingUpload] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sendMessage, isProcessing, processingSteps } = useChat()
  const { state } = useApp()
  const { user } = state

  const MAX_CHARS = 2000
  const canSend = input.trim().length > 0 && !isProcessing && charCount <= MAX_CHARS && !fileError

  const clearSelectedFile = useCallback(() => {
    releaseLocalFile({ objectUrl: previewUrl, input: fileInputRef.current })
    setPreviewUrl(null)
    setSelectedFile(null)
    setFileError(null)
  }, [previewUrl])

  const applySelectedFile = useCallback((file: File) => {
    const check = validateUploadFile(file)
    if (!check.ok) {
      setSelectedFile(null)
      setFileError(check.reason)
      releaseLocalFile({ objectUrl: previewUrl, input: fileInputRef.current })
      setPreviewUrl(null)
      return
    }

    releaseLocalFile({ objectUrl: previewUrl })
    setPreviewUrl(URL.createObjectURL(file))
    setSelectedFile(file)
    setFileError(null)
    textareaRef.current?.focus()
  }, [previewUrl])

  useEffect(() => {
    return () => {
      releaseLocalFile({ objectUrl: previewUrl })
    }
  }, [previewUrl])

  // Importa automaticamente arquivo arrastado na área do chat
  useEffect(() => {
    if (!pendingFile || isProcessing) return
    applySelectedFile(pendingFile)
    onPendingFileHandled?.()
  }, [pendingFile, isProcessing, applySelectedFile, onPendingFileHandled])

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    applySelectedFile(file)
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isProcessing || fileError) return

    const fileToSend = selectedFile

    setInput('')
    setCharCount(0)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setSendingUpload(!!fileToSend)
    // Limpa o anexo da UI imediatamente; o File segue em memória até o fim do upload
    clearSelectedFile()

    try {
      await sendMessage(trimmed, fileToSend)
    } finally {
      setSendingUpload(false)
    }
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
      {(!state.currentConversation || (
        state.currentConversation.messages.length === 0 &&
        !state.conversationLoadingId &&
        !state.conversationLoadError
      )) ? (
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
        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl">
            <FileText size={14} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelectedFile}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              title="Remover arquivo"
              disabled={isProcessing}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className={`relative flex items-end gap-2 p-3 bg-[var(--bg-secondary)] border rounded-2xl transition-all ${
          isAtLimit || fileError
            ? 'border-red-400 dark:border-red-600' 
            : 'border-[var(--border-color)] focus-within:border-blue-400 dark:focus-within:border-blue-600'
        }`}>
          {/* Attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={isProcessing}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.png,.jpg,.jpeg,.gif,.webp,.bmp,.zip,.7z,.rar"
          />
          <button
            type="button"
            className={`p-1.5 transition-colors flex-shrink-0 self-end mb-0.5 ${
              selectedFile
                ? 'text-blue-600'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            } disabled:opacity-50`}
            title={`Anexar arquivo (máx. ${formatFileSize(MAX_UPLOAD_BYTES)})`}
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={17} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedFile
                ? 'Informe a pasta do OneDrive, ex.: Envie para a pasta /RH/Uploads'
                : 'Faça uma consulta ou arraste um arquivo para o chat...'
            }
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
            <span>Enter para enviar • Arraste arquivos (máx. {formatFileSize(MAX_UPLOAD_BYTES)})</span>
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
        {(isAtLimit || fileError) && (
          <div className="flex items-center gap-1.5 mt-1 px-1 text-xs text-red-500">
            <AlertCircle size={12} />
            <span>{fileError || 'Limite de caracteres atingido'}</span>
          </div>
        )}

        {/* Processing status */}
        {isProcessing && (
          <div className="mt-2 px-1 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>
              {processingSteps.find(step => step.status === 'running')?.label
                || (sendingUpload
                  ? 'Enviando arquivo para o OneDrive...'
                  : 'Consultando OneDrive e SharePoint...')}
            </span>
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
