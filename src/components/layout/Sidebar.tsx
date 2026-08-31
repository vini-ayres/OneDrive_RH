import React, { useMemo, useState } from 'react'
import {
  MessageSquarePlus, Star, FileText,
  BarChart2, Settings, Shield, ChevronRight,
  Trash2, Search, Loader2, Users
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { hasPermission } from '../../utils/rbac'
import { Conversation } from '../../types'
import { formatDistanceToNow, isToday, isYesterday, differenceInCalendarDays, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  updateConversationApi,
  deleteConversationApi,
} from '../../services/apiService'
import { useConversationHistory } from '../../hooks/useDataApi'
import { useQueryClient } from '@tanstack/react-query'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  view?: string
  requiresPermission?: string
  action?: () => void
}

type ConversationGroup = {
  id: string
  label: string
  items: Conversation[]
}

function groupConversations(conversations: Conversation[]): ConversationGroup[] {
  const groups: Record<string, Conversation[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  }

  for (const conv of conversations) {
    const date = conv.updatedAt instanceof Date ? conv.updatedAt : new Date(conv.updatedAt)
    if (!isValid(date)) {
      groups.older.push(conv)
    } else if (isToday(date)) {
      groups.today.push(conv)
    } else if (isYesterday(date)) {
      groups.yesterday.push(conv)
    } else if (differenceInCalendarDays(new Date(), date) <= 7) {
      groups.week.push(conv)
    } else {
      groups.older.push(conv)
    }
  }

  return [
    { id: 'today', label: 'Hoje', items: groups.today },
    { id: 'yesterday', label: 'Ontem', items: groups.yesterday },
    { id: 'week', label: 'Últimos 7 dias', items: groups.week },
    { id: 'older', label: 'Anteriores', items: groups.older },
  ].filter(group => group.items.length > 0)
}

export function Sidebar() {
  const { state, dispatch, newConversation } = useApp()
  const { user, sidebarOpen, activeView, currentConversation, conversations, conversationLoadingId } = state
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredConv, setHoveredConv] = useState<string | null>(null)
  const { isLoading: historyLoading, isError: historyError, refetch } = useConversationHistory()
  const queryClient = useQueryClient()

  const canViewAudit = hasPermission(user, 'canViewAuditLog')
  const canViewDashboard = hasPermission(user, 'canViewDashboard')
  const canManageUsers = hasPermission(user, 'canManageUsers')

  const navItems: NavItem[] = [
    {
      id: 'new-chat',
      label: 'Nova conversa',
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

  if (canManageUsers) {
    navItems.push({
      id: 'users',
      label: 'Usuários',
      icon: <Users size={16} />,
      view: 'users',
    })
  }

  navItems.push({
    id: 'settings',
    label: 'Configurações',
    icon: <Settings size={16} />,
    view: 'settings',
  })

  const closeSidebarOnMobile = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      dispatch({ type: 'SET_SIDEBAR', payload: false })
    }
  }

  const handleNavClick = (item: NavItem) => {
    if (item.action) {
      item.action()
    } else if (item.view) {
      dispatch({ type: 'SET_VIEW', payload: item.view as typeof activeView })
    }
    closeSidebarOnMobile()
  }

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const favoriteConvs = filteredConversations.filter(c => c.isFavorite)
  const regularConvs = filteredConversations.filter(c => !c.isFavorite)
  const groupedRegular = useMemo(() => groupConversations(regularConvs), [regularConvs])

  const handleConvClick = (conv: Conversation) => {
    dispatch({ type: 'SET_CONVERSATION', payload: conv })
    dispatch({ type: 'SET_VIEW', payload: 'chat' })
    closeSidebarOnMobile()
  }

  const toggleFavorite = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation()
    const nextFavorite = !conv.isFavorite
    dispatch({
      type: 'UPDATE_CONVERSATION',
      payload: { ...conv, isFavorite: nextFavorite },
    })
    if (state.user) {
      try {
        await updateConversationApi(state.user, conv.id, { isFavorite: nextFavorite })
      } catch {
        dispatch({
          type: 'UPDATE_CONVERSATION',
          payload: { ...conv, isFavorite: conv.isFavorite },
        })
      }
    }
  }

  const deleteConversation = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation()
    dispatch({ type: 'DELETE_CONVERSATION', payload: conv.id })
    if (!state.user) return
    try {
      await deleteConversationApi(state.user, conv.id)
      void queryClient.invalidateQueries({ queryKey: ['conversations', state.user.id] })
    } catch {
      dispatch({ type: 'UPDATE_CONVERSATION', payload: conv })
    }
  }

  return (
    <aside
      className={`sidebar-panel h-full border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col ${
        sidebarOpen ? '' : 'sidebar-panel--closed'
      }`}
      aria-hidden={!sidebarOpen}
    >
      <nav className="p-3 space-y-1 min-w-[var(--sidebar-width)]">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item)}
            className={`sidebar-item sidebar-nav-item group w-full text-left ${
              item.view && activeView === item.view ? 'active' : ''
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.view && (
              <ChevronRight
                size={14}
                className="ml-auto opacity-0 translate-x-[-4px] transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
              />
            )}
          </button>
        ))}
      </nav>

      <hr className="border-[var(--border-color)] mx-3" />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3 min-w-[var(--sidebar-width)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Conversas
          </span>
        </div>

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
          {historyLoading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : historyError && conversations.length === 0 ? (
            <div className="text-center py-6 px-2">
              <p className="text-xs text-[var(--text-muted)] mb-2">
                Não foi possível carregar o histórico.
              </p>
              <button
                onClick={() => refetch()}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {favoriteConvs.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-1 mb-1 mt-1 flex items-center gap-1">
                    <Star size={10} className="fill-yellow-400 text-yellow-400" />
                    Favoritos
                  </p>
                  {favoriteConvs.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={currentConversation?.id === conv.id}
                      isLoading={conversationLoadingId === conv.id}
                      isHovered={hoveredConv === conv.id}
                      onSelect={handleConvClick}
                      onHover={setHoveredConv}
                      onToggleFavorite={toggleFavorite}
                      onDelete={deleteConversation}
                    />
                  ))}
                  <hr className="border-[var(--border-color)] my-2" />
                </>
              )}

              {groupedRegular.length > 0 ? (
                groupedRegular.map(group => (
                  <div key={group.id} className="mb-2">
                    {(favoriteConvs.length > 0 || groupedRegular.length > 1) && (
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-1 mb-1 mt-1">
                        {group.label}
                      </p>
                    )}
                    {group.items.map(conv => (
                      <ConversationItem
                        key={conv.id}
                        conv={conv}
                        isActive={currentConversation?.id === conv.id}
                        isLoading={conversationLoadingId === conv.id}
                        isHovered={hoveredConv === conv.id}
                        onSelect={handleConvClick}
                        onHover={setHoveredConv}
                        onToggleFavorite={toggleFavorite}
                        onDelete={deleteConversation}
                      />
                    ))}
                  </div>
                ))
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
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function ConversationItem({
  conv,
  isActive,
  isLoading,
  isHovered,
  onSelect,
  onHover,
  onToggleFavorite,
  onDelete,
}: {
  conv: Conversation
  isActive: boolean
  isLoading: boolean
  isHovered: boolean
  onSelect: (conv: Conversation) => void
  onHover: (id: string | null) => void
  onToggleFavorite: (e: React.MouseEvent, conv: Conversation) => void
  onDelete: (e: React.MouseEvent, conv: Conversation) => void
}) {
  return (
    <div
      onClick={() => onSelect(conv)}
      onMouseEnter={() => onHover(conv.id)}
      onMouseLeave={() => onHover(null)}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="flex-1 truncate text-xs">{conv.title}</span>
      {isLoading ? (
        <Loader2 size={11} className="animate-spin text-[var(--text-muted)]" />
      ) : isHovered ? (
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={(e) => onToggleFavorite(e, conv)}
            className="p-1 rounded hover:bg-[var(--border-color)] text-[var(--text-muted)]"
            title={conv.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star size={11} className={conv.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''} />
          </button>
          <button
            onClick={(e) => onDelete(e, conv)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--text-muted)] hover:text-red-500"
            title="Excluir conversa"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ) : (
        <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
          {isValid(conv.updatedAt)
            ? formatDistanceToNow(conv.updatedAt, { addSuffix: true, locale: ptBR })
            : ''}
        </span>
      )}
    </div>
  )
}
