import { 
  ChatPayload, ChatApiResponse, ApiResponse, 
  AuditLog, AuditFilters, DashboardStats,
  ChartDataPoint, DocumentSource, UserProfile
} from '../types'
import { generateCsrfToken } from '../utils/security'

const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678/webhook'

// Timeout padrão de 60 segundos
const DEFAULT_TIMEOUT = 60000

// CSRF token para a sessão
const csrfToken = generateCsrfToken()

/**
 * Fetch com timeout e retry automático
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = 2,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<ApiResponse<T>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headersInit: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    'X-Requested-With': 'XMLHttpRequest',
    'X-Client-Version': '1.0.0',
  }

  // Adicionar headers de autenticação se existir token
  const existingHeaders = options.headers as Record<string, string> | undefined
  if (existingHeaders) {
    Object.assign(headersInit, existingHeaders)
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: headersInit,
      signal: controller.signal,
      // Credentials apenas para same-origin
      credentials: 'same-origin',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED')
      }
      if (response.status === 403) {
        throw new Error('FORBIDDEN')
      }
      if (response.status === 429) {
        throw new Error('RATE_LIMITED')
      }
      throw new Error(`HTTP_ERROR_${response.status}`)
    }

    const data = await response.json() as ApiResponse<T>
    return data

  } catch (error: unknown) {
    clearTimeout(timeoutId)

    const err = error as Error
    if (err.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT')
    }

    // Retry em erros de rede (não de autenticação)
    if (retries > 0 && !['UNAUTHORIZED', 'FORBIDDEN', 'RATE_LIMITED'].includes(err.message)) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)))
      return fetchWithRetry<T>(url, options, retries - 1, timeoutMs)
    }

    throw error
  }
}

/**
 * Envia uma mensagem de chat para o backend n8n
 */
export async function sendChatMessage(
  payload: ChatPayload
): Promise<ApiResponse<ChatApiResponse>> {
  return fetchWithRetry<ChatApiResponse>(
    `${N8N_BASE_URL}/chat`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${payload.accessToken}`,
      },
      body: JSON.stringify({
        query: payload.query,
        userId: payload.userId,
        userName: payload.userName,
        userEmail: payload.userEmail,
        userGroups: payload.userGroups,
        userRoles: payload.userRoles,
        conversationId: payload.conversationId,
        context: payload.context?.slice(-10), // Últimas 10 mensagens como contexto
        metadata: payload.metadata,
      }),
    },
    2,
    120000 // 2 minutos para respostas de IA
  )
}

/**
 * Busca documentos
 */
export async function searchDocuments(
  query: string,
  user: UserProfile,
  filters?: { type?: string; folder?: string }
): Promise<ApiResponse<DocumentSource[]>> {
  return fetchWithRetry<DocumentSource[]>(
    `${N8N_BASE_URL}/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
      },
      body: JSON.stringify({
        query,
        userId: user.id,
        userGroups: user.groups,
        userRoles: user.roles,
        filters,
      }),
    }
  )
}

/**
 * Obtém histórico de conversas
 */
export async function getConversationHistory(
  user: UserProfile
): Promise<ApiResponse<{ conversations: Array<{ id: string; title: string; updatedAt: string }> }>> {
  return fetchWithRetry(
    `${N8N_BASE_URL}/history?userId=${encodeURIComponent(user.id)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
      },
    }
  )
}

/**
 * Obtém perfil completo do usuário via Microsoft Graph
 */
export async function getUserProfile(accessToken: string): Promise<UserProfile | null> {
  try {
    const [profileRes, photoRes] = await Promise.allSettled([
      fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,jobTitle,department,officeLocation,mobilePhone', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
    ])

    if (profileRes.status === 'rejected' || !profileRes.value.ok) {
      return null
    }

    const profileData = await profileRes.value.json() as {
      id: string
      displayName: string
      mail: string
      jobTitle: string
      department: string
      officeLocation: string
      mobilePhone: string
    }

    let photoUrl: string | undefined
    if (photoRes.status === 'fulfilled' && photoRes.value.ok) {
      const blob = await photoRes.value.blob()
      photoUrl = URL.createObjectURL(blob)
    }

    return {
      id: profileData.id,
      displayName: profileData.displayName,
      email: profileData.mail,
      jobTitle: profileData.jobTitle || '',
      department: profileData.department || '',
      officeLocation: profileData.officeLocation || '',
      mobilePhone: profileData.mobilePhone || '',
      photoUrl,
      roles: [],
      groups: [],
      accessToken: '',
      idToken: '',
      tenantId: '',
      sessionStart: new Date(),
      lastActivity: new Date(),
    }
  } catch {
    return null
  }
}

/**
 * Obtém grupos do usuário via Microsoft Graph
 */
export async function getUserGroups(accessToken: string): Promise<string[]> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName,id', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!res.ok) return []

    const data = await res.json() as { value: Array<{ displayName: string; id: string }> }
    return data.value.map(g => g.displayName).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Obtém logs de auditoria
 */
export async function getAuditLogs(
  user: UserProfile,
  filters: AuditFilters
): Promise<ApiResponse<{ logs: AuditLog[]; total: number }>> {
  const params = new URLSearchParams()
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.startDate) params.set('startDate', filters.startDate.toISOString())
  if (filters.endDate) params.set('endDate', filters.endDate.toISOString())
  if (filters.result) params.set('result', filters.result)
  if (filters.documentName) params.set('documentName', filters.documentName)

  return fetchWithRetry(
    `${N8N_BASE_URL}/audit?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
      },
    }
  )
}

/**
 * Obtém estatísticas do dashboard
 */
export async function getDashboardStats(
  user: UserProfile
): Promise<ApiResponse<DashboardStats>> {
  return fetchWithRetry(
    `${N8N_BASE_URL}/dashboard/stats`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
      },
    }
  )
}

/**
 * Obtém dados de gráficos para o dashboard
 */
export async function getDashboardChartData(
  user: UserProfile,
  period: '7d' | '30d' | '90d' = '7d'
): Promise<ApiResponse<{ timeline: ChartDataPoint[] }>> {
  return fetchWithRetry(
    `${N8N_BASE_URL}/dashboard/charts?period=${period}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
      },
    }
  )
}

/**
 * Registra evento de auditoria local (fallback quando API está offline)
 */
export function logAuditEventLocal(event: Partial<AuditLog>): void {
  try {
    const existing = sessionStorage.getItem('audit_buffer') 
    const buffer: Partial<AuditLog>[] = existing ? JSON.parse(existing) as Partial<AuditLog>[] : []
    buffer.push({ ...event, timestamp: new Date() })
    // Manter apenas os últimos 100 eventos no buffer
    if (buffer.length > 100) buffer.splice(0, buffer.length - 100)
    sessionStorage.setItem('audit_buffer', JSON.stringify(buffer))
  } catch {
    // Falha silenciosa - não bloquear a aplicação
  }
}
