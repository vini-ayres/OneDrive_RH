import React, { useState } from 'react'
import {
  MessageSquarePlus, History, Star, FileText,
  BarChart2, Settings, Shield, ChevronRight,
  Trash2, MoreHorizontal, Search
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { hasPermission } from '../../utils/rbac'
import { Conversation } from '../../types'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  view?: string
  requiresPermission?: string
  action?: () => void
}

export function Sidebar() {
  const { state, dispatch, newConversation } = useApp()
  const { user, sidebarOpen, activeView, currentConversation, conversations } = state
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredConv, setHoveredConv] = useState<string | null>(null)

  if (!sidebarOpen) return null

  const canViewAudit = hasPermission(user, 'canViewAuditLog')
  const canViewDashboard = hasPermission(user, 'canViewDashboard')

  const navItems: NavItem[] = [
    {
      id: 'new-chat',
      label: 'Nova Conversa',
      icon: <MessageSquarePlus size={16} />,
      action: () => {
        newConversation()
        dispatch({ type: 'SET_VIEW', payload: 'chat' })
      }
    },
    {
      id: 'documents',
      label: 'Documentos Recentes',
      icon: <FileText size={16} />,
      view: 'documents',
    },
  ]

  if (canViewDashboard) {
    navItems.push({
      id: 'dashboard',
      label: 'Dashboard',
      icon: <BarChart2 size={16} />,
      view: 'dashboard',
    })
  }

  if (canViewAudit) {
    navItems.push({
      id: 'audit',
      label: 'Auditoria',
      icon: <Shield size={16} />,
      view: 'audit',
    })
  }

  navItems.push({
    id: 'settings',
    label: 'Configurações',
    icon: <Settings size={16} />,
    view: 'settings',
  })

  const handleNavClick = (item: NavItem) => {
    if (item.action) {
      item.action()
    } else if (item.view) {
      dispatch({ type: 'SET_VIEW', payload: item.view as typeof activeView })
    }
  }

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const favoriteConvs = filteredConversations.filter(c => c.isFavorite)
  const regularConvs = filteredConversations.filter(c => !c.isFavorite)

  const handleConvClick = (conv: Conversation) => {
    dispatch({ type: 'SET_CONVERSATION', payload: conv })
    dispatch({ type: 'SET_VIEW', payload: 'chat' })
  }

  const toggleFavorite = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation()
    dispatch({
      type: 'UPDATE_CONVERSATION',
      payload: { ...conv, isFavorite: !conv.isFavorite }
    })
  }

  const deleteConversation = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation()
    dispatch({ type: 'DELETE_CONVERSATION', payload: convId })
  }

  const ConversationItem = ({ conv }: { conv: Conversation }) => (
    <div
      key={conv.id}
      onClick={() => handleConvClick(conv)}
      onMouseEnter={() => setHoveredConv(conv.id)}
      onMouseLeave={() => setHoveredConv(null)}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all ${
        currentConversation?.id === conv.id
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="flex-1 truncate text-xs">{conv.title}</span>
      <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap hidden group-hover:hidden">
        {formatDistanceToNow(conv.updatedAt, { addSuffix: true, locale: ptBR })}
      </span>
      {hoveredConv === conv.id && (
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={(e) => toggleFavorite(e, conv)}
            className="p-1 rounded hover:bg-[var(--border-color)] text-[var(--text-muted)]"
            title={conv.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star size={11} className={conv.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''} />
          </button>
          <button
            onClick={(e) => deleteConversation(e, conv.id)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--text-muted)] hover:text-red-500"
            title="Excluir conversa"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <aside className="w-[260px] flex-shrink-0 h-full border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden">
      {/* Navigation items */}
      <nav className="p-3 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item)}
            className={`sidebar-item w-full text-left ${
              item.view && activeView === item.view ? 'active' : ''
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.view && (
              <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100" />
            )}
          </button>
        ))}
      </nav>

      <hr className="border-[var(--border-color)] mx-3" />

      {/* Conversations section */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Conversas
          </span>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'chat' })}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
          >
            <History size={14} />
          </button>
        </div>

        {/* Search conversations */}
        {conversations.length > 3 && (
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-[var(--text-primary)]"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-hidden">
          {favoriteConvs.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-1 mb-1 mt-1 flex items-center gap-1">
                <Star size={10} className="fill-yellow-400 text-yellow-400" />
                Favoritos
              </p>
              {favoriteConvs.map(conv => (
                <ConversationItem key={conv.id} conv={conv} />
              ))}
              <hr className="border-[var(--border-color)] my-2" />
            </>
          )}

          {regularConvs.length > 0 ? (
            <>
              {favoriteConvs.length > 0 && (
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-1 mb-1 mt-1">
                  Recentes
                </p>
              )}
              {regularConvs.map(conv => (
                <ConversationItem key={conv.id} conv={conv} />
              ))}
            </>
          ) : (
            conversations.length === 0 && (
              <div className="text-center py-6">
                <MessageSquarePlus size={24} className="mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-xs text-[var(--text-muted)]">
                  Nenhuma conversa ainda
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Inicie uma nova consulta acima
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-[var(--text-muted)]">
            Sistema Online
          </span>
          <button className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
