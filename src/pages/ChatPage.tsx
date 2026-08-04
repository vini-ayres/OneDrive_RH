import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { MessageBubble } from '../components/chat/MessageBubble'
import { ChatInput } from '../components/chat/ChatInput'
import { useApp } from '../contexts/AppContext'
import { Shield, FileSearch, Sparkles } from 'lucide-react'
import { RoleBadge } from '../components/ui/Badge'
import { getHighestRole } from '../utils/rbac'

const SCROLL_THRESHOLD = 100

export function ChatPage() {
  const { state } = useApp()
  const { user, currentConversation } = state
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesListRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const conversationIdRef = useRef<string | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior })
  }, [])

  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return true
    const { scrollTop, scrollHeight, clientHeight } = container
    return scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD
  }, [])

  const handleScroll = useCallback(() => {
    isNearBottomRef.current = checkIfNearBottom()
  }, [checkIfNearBottom])

  const shouldAutoScroll = useCallback(() => {
    if (isNearBottomRef.current) return true

    const messages = currentConversation?.messages
    if (!messages?.length) return false

    const last = messages[messages.length - 1]
    return last.role === 'user' || last.status === 'sending'
  }, [currentConversation?.messages])

  // Ao trocar de conversa, rolar sempre para o fim
  useEffect(() => {
    const convId = currentConversation?.id ?? null
    if (convId === conversationIdRef.current) return

    conversationIdRef.current = convId
    isNearBottomRef.current = true
    requestAnimationFrame(() => scrollToBottom('auto'))
  }, [currentConversation?.id, scrollToBottom])

  // Ao mudar mensagens, rolar se o usuário estiver perto do fim ou acabou de enviar
  useLayoutEffect(() => {
    if (!currentConversation?.messages.length) return
    if (!shouldAutoScroll()) return

    scrollToBottom('auto')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom('auto'))
    })
  }, [currentConversation?.messages, shouldAutoScroll, scrollToBottom])

  // Observar expansão de conteúdo (markdown, fontes, animações)
  useEffect(() => {
    const list = messagesListRef.current
    if (!list) return

    const observer = new ResizeObserver(() => {
      if (shouldAutoScroll()) {
        scrollToBottom('auto')
      }
    })
    observer.observe(list)
    return () => observer.disconnect()
  }, [currentConversation?.id, shouldAutoScroll, scrollToBottom])

  const hasMessages = currentConversation && currentConversation.messages.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {!hasMessages ? (
          // Welcome screen
          <div className="flex flex-col items-center justify-center h-full px-4 py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <Shield size={32} className="text-white" />
            </div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2 text-center">
              RH Inteligente
            </h2>
            <p className="text-[var(--text-secondary)] text-center max-w-md mb-1">
              Sistema Corporativo de Consulta de Documentos
            </p>
            {user && (
              <p className="text-sm text-[var(--text-muted)] text-center mb-6">
                Olá, <strong className="text-[var(--text-primary)]">{user.displayName.split(' ')[0]}</strong>! 
                Como posso ajudá-lo hoje?
              </p>
            )}

            {/* User role info */}
            {user && (
              <div className="flex items-center gap-2 mb-8">
                <span className="text-xs text-[var(--text-muted)]">Seu perfil de acesso:</span>
                <RoleBadge role={getHighestRole(user.roles)} />
              </div>
            )}

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
              <FeatureCard
                icon={<FileSearch size={20} className="text-blue-600" />}
                title="Busca Inteligente"
                description="Consulte documentos no OneDrive e SharePoint em linguagem natural"
              />
              <FeatureCard
                icon={<Shield size={20} className="text-green-600" />}
                title="Acesso Seguro"
                description="Controle de acesso baseado no seu perfil e grupos do Active Directory"
              />
              <FeatureCard
                icon={<Sparkles size={20} className="text-purple-600" />}
                title="IA Corporativa"
                description="Análise e sumarização automática de documentos corporativos"
              />
            </div>

            {/* LGPD notice */}
            <div className="mt-8 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl max-w-lg w-full">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                🔒 Todas as consultas são registradas em conformidade com a LGPD. 
                O acesso é limitado ao seu perfil de permissões.
              </p>
            </div>
          </div>
        ) : (
          // Messages list
          <div
            ref={messagesListRef}
            className="max-w-3xl mx-auto px-4 py-6 space-y-6"
          >
            {currentConversation.messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {/* Chat input */}
      <ChatInput />
    </div>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="card hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
    </div>
  )
}
