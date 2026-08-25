import { useQuery } from '@tanstack/react-query'
import { useApp } from '../contexts/AppContext'
import {
  getConversationHistory,
  getConversationMessages,
  getAuditLogs,
  getDashboardStats,
  getDashboardChartData,
  getRecentDocuments,
} from '../services/apiService'
import { AuditFilters, Conversation, ChatMessage } from '../types'
import { mapApiMessages } from '../utils/conversation'

export function useConversationHistory() {
  const { state } = useApp()
  const user = state.user

  return useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return []
      const response = await getConversationHistory(user)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar conversas')
      }
      return response.data.conversations.map(
        (c): Conversation => ({
          id: c.id,
          title: c.title,
          messages: [],
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(c.updatedAt),
          updatedAt: new Date(c.updatedAt),
          isFavorite: c.isFavorite ?? false,
          userId: user.id,
        })
      )
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

export function useConversationMessages(conversationId: string | null) {
  const { state } = useApp()
  const user = state.user

  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!user || !conversationId) return null
      const response = await getConversationMessages(user, conversationId)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar mensagens')
      }

      const messages: ChatMessage[] = mapApiMessages(response.data.messages)

      return {
        conversation: response.data.conversation,
        messages,
      }
    },
    enabled: !!user && !!conversationId,
  })
}

export function useDashboardData(period: '7d' | '30d' | '90d' = '7d') {
  const { state } = useApp()
  const user = state.user

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      if (!user) return null
      const response = await getDashboardStats(user)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar estatísticas')
      }
      return response.data
    },
    enabled: !!user,
  })

  const chartsQuery = useQuery({
    queryKey: ['dashboard-charts', period],
    queryFn: async () => {
      if (!user) return null
      const response = await getDashboardChartData(user, period)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar gráficos')
      }
      return response.data as {
        timeline: Array<{ date: string; queries: number; users: number; blocked: number }>
        topUsers?: Array<{ userName: string; email: string; queries: number }>
        topDocuments?: Array<{ documentName: string; type: string; accesses: number }>
        securityEvents?: Array<{ date: string; denied: number; blocked: number; errors: number }>
      }
    },
    enabled: !!user,
  })

  return { statsQuery, chartsQuery }
}

export function useAuditLogs(filters: AuditFilters, page = 1, pageSize = 15) {
  const { state } = useApp()
  const user = state.user

  return useQuery({
    queryKey: ['audit-logs', filters, page, pageSize],
    queryFn: async () => {
      if (!user) return { logs: [], total: 0 }

      const response = await getAuditLogs(user, filters, { page, pageSize })
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar auditoria')
      }

      return {
        logs: response.data.logs.map((log) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        })),
        total: response.data.total,
      }
    },
    enabled: !!user,
  })
}

export function useRecentDocuments(limit = 50) {
  const { state } = useApp()
  const user = state.user

  return useQuery({
    queryKey: ['recent-documents', limit],
    queryFn: async () => {
      if (!user) return []
      const response = await getRecentDocuments(user, limit)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao carregar documentos')
      }
      return response.data.documents.map((d) => ({
        ...d,
        modifiedAt: new Date(d.modifiedAt),
      }))
    },
    enabled: !!user,
  })
}
