import { 
  ChatPayload, ChatApiResponse, ApiResponse, 
  AuditLog, AuditFilters, DashboardStats,
  ChartDataPoint, DocumentSource, ProcessingStep, UserProfile,
  UploadPayload, UploadApiResponse,
} from '../types'
import { generateCsrfToken, generateSessionId } from '../utils/security'
import { fileToBase64 } from '../utils/uploadHelpers'
import {
  LOCAL_TEST_ACCESS_TOKEN,
  LOCAL_TEST_USER_EMAIL,
  LOCAL_TEST_USER_ID,
  LOCAL_TEST_USER_NAME,
} from '../utils/localTestUser'

const N8N_BASE_URL = (import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678/webhook').trim()
const N8N_CHAT_WEBHOOK_URL = (
  import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL?.trim() ||
  resolveChatWebhookUrl(N8N_BASE_URL)
).replace(/\/+$/, '')
const N8N_UPLOAD_WEBHOOK_URL = (
  import.meta.env.VITE_N8N_UPLOAD_WEBHOOK_URL?.trim() ||
  resolveUploadWebhookUrl(N8N_BASE_URL)
).replace(/\/+$/, '')

// Timeout padrão de 60 segundos
const DEFAULT_TIMEOUT = 60000

// CSRF token para a sessão
const csrfToken = generateCsrfToken()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function resolveChatWebhookUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')

  // Se o usuário já configurou o webhook completo (ex.: /webhook/one-drive-tst),
  // usamos exatamente esse endpoint.
  if (normalized.includes('/webhook/') && !normalized.endsWith('/webhook')) {
    return normalized
  }

  // Compatibilidade com a configuração antiga, onde o front montava /chat.
  if (normalized.endsWith('/webhook')) {
    return `${normalized}/chat`
  }

  return normalized
}

function resolveNamedWebhookUrl(baseUrl: string, webhookName: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')

  if (normalized.endsWith('/webhook')) {
    return `${normalized}/${webhookName}`
  }

  if (normalized.includes('/webhook/')) {
    return `${normalized.replace(/\/webhook\/[^/]+\/?$/, '/webhook')}/${webhookName}`
  }

  return `${normalized}/${webhookName}`
}

function resolveUploadWebhookUrl(baseUrl: string): string {
  return resolveNamedWebhookUrl(baseUrl, 'upload-onedrive')
}

function normalizeApiResponse<T>(payload: unknown): ApiResponse<T> {
  const timestamp = new Date().toISOString()

  if (payload == null) {
    return { success: true, data: undefined as T, timestamp }
  }

  if (typeof payload === 'string') {
    return { success: true, data: payload as T, timestamp }
  }

  if (!isRecord(payload)) {
    return { success: true, data: payload as T, timestamp }
  }

  const data = 'data' in payload && payload.data !== undefined
    ? payload.data
    : payload

  return {
    success: typeof payload.success === 'boolean' ? payload.success : true,
    data: data as T,
    error: typeof payload.error === 'string' ? payload.error : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
    timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : timestamp,
  }
}

function coerceChatResponse(payload: unknown): ChatApiResponse | null {
  if (payload == null) return null

  if (typeof payload === 'string') {
    return {
      answer: payload,
      sources: [],
      processingSteps: [],
      wasBlocked: false,
      requestId: generateSessionId(),
      processingTimeMs: 0,
    }
  }

  if (!isRecord(payload)) {
    if (Array.isArray(payload) && payload.length > 0) {
      return coerceChatResponse(payload[0])
    }
    return null
  }

  if ('json' in payload && payload.json !== undefined) {
    const nestedJson = coerceChatResponse(payload.json)
    if (nestedJson) return nestedJson
  }

  if ('body' in payload && payload.body !== undefined) {
    const nestedBody = coerceChatResponse(payload.body)
    if (nestedBody) return nestedBody
  }

  if ('data' in payload && payload.data !== undefined) {
    const nested = coerceChatResponse(payload.data)
    if (nested) return nested
  }

  const answer =
    typeof payload.answer === 'string'
      ? payload.answer
      : typeof payload.reply === 'string'
        ? payload.reply
      : typeof payload.message === 'string'
        ? payload.message
        : typeof payload.response === 'string'
          ? payload.response
          : typeof payload.output === 'string'
            ? payload.output
            : typeof payload.result === 'string'
              ? payload.result
            : typeof payload.text === 'string'
              ? payload.text
              : typeof payload.content === 'string'
                ? payload.content
          : null

  if (!answer) return null

  const normalizedAnswer = answer.trim()
  const looksLikeWorkflowError = /workflow execution failed|internal server error|error executing workflow/i.test(normalizedAnswer)
  if (looksLikeWorkflowError && !payload.answer) {
    return null
  }

  const sources = Array.isArray(payload.sources) ? payload.sources as DocumentSource[] : []
  const processingSteps = Array.isArray(payload.processingSteps) ? payload.processingSteps as ProcessingStep[] : []

  return {
    answer,
    sources,
    processingSteps,
    blockedReason: typeof payload.blockedReason === 'string' ? payload.blockedReason : undefined,
    wasBlocked: Boolean(payload.wasBlocked),
    requestId: typeof payload.requestId === 'string' ? payload.requestId : generateSessionId(),
    processingTimeMs: typeof payload.processingTimeMs === 'number' ? payload.processingTimeMs : 0,
  }
}

function isLocalTestAccessToken(accessToken?: string): boolean {
  return accessToken === LOCAL_TEST_ACCESS_TOKEN
}

function buildN8nAuthHeaders(accessToken?: string): Record<string, string> {
  if (isLocalTestAccessToken(accessToken) || !accessToken) {
    return {}
  }

  return { Authorization: `Bearer ${accessToken}` }
}

function createApiResponse<T>(data: T, requestId = generateSessionId()): ApiResponse<T> {
  return {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  }
}

function createMockSources(query: string): DocumentSource[] {
  const normalized = query.toLowerCase()
  const now = new Date()

  const baseSources: DocumentSource[] = [
    {
      id: generateSessionId(),
      name: 'Regulamento_Interno_2024.pdf',
      path: '/RH/Políticas/Regulamento_Interno_2024.pdf',
      modifiedAt: now,
      webUrl: 'https://example.com/regulamento-interno',
      type: 'pdf',
      relevanceScore: 0.97,
      excerpt: 'Documento-base com políticas internas, condutas e regras de acesso.',
    },
    {
      id: generateSessionId(),
      name: 'Manual_de_Onboarding.pdf',
      path: '/RH/Admissão/Manual_de_Onboarding.pdf',
      modifiedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      webUrl: 'https://example.com/manual-onboarding',
      type: 'pdf',
      relevanceScore: 0.89,
      excerpt: 'Resumo do processo de integração e documentos admissionais.',
    },
    {
      id: generateSessionId(),
      name: 'Política_de_Benefícios_v3.docx',
      path: '/RH/Políticas/Política_de_Benefícios_v3.docx',
      modifiedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      webUrl: 'https://example.com/politica-beneficios',
      type: 'docx',
      relevanceScore: 0.84,
      excerpt: 'Regras de benefícios, elegibilidade e procedimentos de solicitação.',
    },
  ]

  if (normalized.includes('contrat')) {
    return [
      {
        id: generateSessionId(),
        name: 'Contrato_Trabalho_Template.docx',
        path: '/RH/Contratos/Contrato_Trabalho_Template.docx',
        modifiedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        webUrl: 'https://example.com/contrato-trabalho',
        type: 'docx',
        relevanceScore: 0.98,
        excerpt: 'Modelo de contrato de trabalho e cláusulas padrão.',
      },
      baseSources[0],
    ]
  }

  if (normalized.includes('holer') || normalized.includes('salario') || normalized.includes('salário')) {
    return [
      {
        id: generateSessionId(),
        name: 'Holerite_Template.xlsx',
        path: '/RH/Holerites/Holerite_Template.xlsx',
        modifiedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        webUrl: 'https://example.com/holerite',
        type: 'xlsx',
        relevanceScore: 0.96,
        excerpt: 'Estrutura de demonstrativo de pagamento para fins de teste.',
      },
      baseSources[2],
    ]
  }

  return baseSources
}

function createProcessingSteps(): ProcessingStep[] {
  const now = new Date()
  return [
    { id: 'auth', label: 'Verificando autenticação...', status: 'done', timestamp: now },
    { id: 'search', label: 'Consultando OneDrive/SharePoint...', status: 'done', timestamp: now },
    { id: 'analyze', label: 'Analisando documentos...', status: 'done', timestamp: now },
    { id: 'generate', label: 'Gerando resposta...', status: 'done', timestamp: now },
  ]
}

function createLocalChatResponse(query: string): ApiResponse<ChatApiResponse> {
  const sources = createMockSources(query)
  const lower = query.toLowerCase()

  let answer = `**Resposta local de teste**\n\nRecebi a consulta: "${query}".\n\nEste ambiente está em modo local, então a resposta abaixo é simulada para validar a interface, o RBAC e a apresentação de fontes.`

  if (lower.includes('contrat')) {
    answer += `\n\nPara testes, a busca aponta para o modelo de contrato e o regulamento interno, que normalmente são os principais documentos de referência nesta categoria.`
  } else if (lower.includes('holer') || lower.includes('salario') || lower.includes('salário')) {
    answer += `\n\nPara testes, a consulta encontrou um holerite-modelo e a política de benefícios associada.`
  } else if (lower.includes('documentos admissionais') || lower.includes('admiss')) {
    answer += `\n\nPara testes, o ambiente retorna o manual de onboarding e documentos admissionais correlatos.`
  } else {
    answer += `\n\nVocê pode usar este perfil local para navegar pelo dashboard, documentos, auditoria e chat sem depender do backend n8n.`
  }

  return createApiResponse<ChatApiResponse>({
    answer,
    sources,
    processingSteps: createProcessingSteps(),
    wasBlocked: false,
    requestId: generateSessionId(),
    processingTimeMs: 640,
  })
}

function createLocalDocumentResults(query: string): DocumentSource[] {
  return createMockSources(query)
}

function createLocalHistory() {
  return {
    conversations: [
      {
        id: 'local-conv-1',
        title: 'Consulta de contrato',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'local-conv-2',
        title: 'Holerite e benefícios',
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }
}

function readLocalAuditBuffer(): AuditLog[] {
  try {
    const existing = sessionStorage.getItem('audit_buffer')
    if (!existing) return []

    const raw = JSON.parse(existing) as Array<Partial<AuditLog>>
    return raw.map(item => ({
      id: item.id || generateSessionId(),
      userId: item.userId || LOCAL_TEST_USER_ID,
      userName: item.userName || LOCAL_TEST_USER_NAME,
      userEmail: item.userEmail || LOCAL_TEST_USER_EMAIL,
      action: item.action || 'chat_query',
      query: item.query || '',
      documentAccessed: item.documentAccessed,
      documentPath: item.documentPath,
      result: item.result || 'success',
      ipAddress: item.ipAddress || 'browser',
      userAgent: item.userAgent || navigator.userAgent,
      timestamp: item.timestamp ? new Date(String(item.timestamp)) : new Date(),
      sessionId: item.sessionId || generateSessionId(),
      role: item.role || 'admin',
      metadata: item.metadata,
    }))
  } catch {
    return []
  }
}

function createLocalDashboardStats(): DashboardStats {
  return {
    queriesToday: 12,
    activeUsers: 1,
    documentsAccessed: 38,
    blockedQueries: 2,
    deniedAccess: 0,
    totalQueriesMonth: 86,
    avgResponseTime: 1.8,
  }
}

function createLocalChartData(period: '7d' | '30d' | '90d'): { timeline: ChartDataPoint[] } {
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
  const start = new Date()
  const points = Array.from({ length: days }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() - (days - 1 - index))

    return {
      date: day.toISOString().slice(0, 10),
      queries: 8 + (index % 7) * 3,
      users: 1 + (index % 4),
      blocked: index % 5 === 0 ? 2 : 0,
    }
  })

  return { timeline: points }
}

function getChatEndpoint(): string {
  if (import.meta.env.DEV) {
    return '/api/n8n/chat'
  }

  return N8N_CHAT_WEBHOOK_URL
}

function getUploadEndpoint(): string {
  if (import.meta.env.DEV) {
    return '/api/n8n/upload'
  }

  return N8N_UPLOAD_WEBHOOK_URL
}

function buildN8nChatPayload(payload: ChatPayload): string {
  const sessionId = payload.metadata?.sessionId || payload.conversationId || generateSessionId()

  return JSON.stringify({
    query: payload.query,
    sessionId,
    session_id: sessionId,
    conversationId: payload.conversationId,
    userId: payload.userId,
  })
}

function extractHttpErrorMessage(status: number, rawText: string): string {
  const trimmed = rawText.trim()

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (isRecord(parsed)) {
        const message = [parsed.message, parsed.error, parsed.detail]
          .find(value => typeof value === 'string' && value.trim())

        if (typeof message === 'string') {
          return message
        }
      }
    } catch {
      if (trimmed.length <= 300) {
        return trimmed
      }
    }
  }

  return `HTTP_ERROR_${status}`
}

/**
 * Fetch para webhooks n8n — headers mínimos para evitar falha de CORS/preflight.
 * Para FormData, não define Content-Type (o browser monta o boundary).
 */
async function fetchN8nWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = 2,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<ApiResponse<T>> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headersInit: Record<string, string> = {}

  const existingHeaders = options.headers as Record<string, string> | undefined
  if (existingHeaders) {
    Object.assign(headersInit, existingHeaders)
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const method = (options.method || 'GET').toUpperCase()

  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    !isFormData &&
    !headersInit['Content-Type'] &&
    !headersInit['content-type']
  ) {
    headersInit['Content-Type'] = 'application/json'
  }

  // Multipart: remover Content-Type forçado para o browser definir o boundary
  if (isFormData) {
    delete headersInit['Content-Type']
    delete headersInit['content-type']
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: headersInit,
      signal: controller.signal,
      credentials: 'omit',
    })

    clearTimeout(timeoutId)

    const rawText = await response.text()
    const trimmed = rawText.trim()

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

      throw new Error(extractHttpErrorMessage(response.status, rawText))
    }

    const parsed = trimmed ? (() => {
      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return trimmed
      }
    })() : null

    return normalizeApiResponse<T>(parsed)
  } catch (error: unknown) {
    clearTimeout(timeoutId)

    const err = error as Error
    if (err.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT')
    }

    if (retries > 0 && !['UNAUTHORIZED', 'FORBIDDEN', 'RATE_LIMITED'].includes(err.message)) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)))
      return fetchN8nWithRetry<T>(url, options, retries - 1, timeoutMs)
    }

    throw error
  }
}

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

    const rawText = await response.text()
    const trimmed = rawText.trim()
    const parsed = trimmed ? (() => {
      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return trimmed
      }
    })() : null

    return normalizeApiResponse<T>(parsed)

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
  try {
    const response = await fetchN8nWithRetry<unknown>(
      getChatEndpoint(),
      {
        method: 'POST',
        headers: buildN8nAuthHeaders(payload.accessToken),
        body: buildN8nChatPayload(payload),
      },
      2,
      120000 // 2 minutos para respostas de IA
    )

    const chatData = coerceChatResponse(response.data)
    if (response.success && chatData) {
      return {
        ...response,
        data: chatData,
      }
    }

    throw new Error(response.error || response.message || 'Erro na resposta da API')
  } catch (error) {
    throw error
  }
}

function coerceUploadResponse(payload: unknown): UploadApiResponse | null {
  if (payload == null) {
    return { success: true, message: 'Upload concluído com sucesso.' }
  }

  if (typeof payload === 'string') {
    const text = payload.trim()
    return text
      ? { success: true, answer: text, message: text }
      : { success: true, message: 'Upload concluído com sucesso.' }
  }

  // Formato do webhook: [{ "text": "..." }, ...]
  if (Array.isArray(payload)) {
    const texts = payload
      .map(item => {
        if (typeof item === 'string') return item.trim()
        if (isRecord(item) && typeof item.text === 'string') return item.text.trim()
        if (isRecord(item) && typeof item.answer === 'string') return item.answer.trim()
        if (isRecord(item) && typeof item.message === 'string') return item.message.trim()
        return ''
      })
      .filter(Boolean)

    if (texts.length > 0) {
      const answer = texts.join('\n\n')
      return { success: true, answer, message: answer }
    }

    if (payload.length > 0) {
      return coerceUploadResponse(payload[0])
    }

    return null
  }

  if (!isRecord(payload)) return null

  if ('json' in payload && payload.json !== undefined) {
    const nested = coerceUploadResponse(payload.json)
    if (nested?.answer || nested?.message) return nested
  }

  if ('body' in payload && payload.body !== undefined) {
    const nested = coerceUploadResponse(payload.body)
    if (nested?.answer || nested?.message) return nested
  }

  if ('data' in payload && payload.data !== undefined && !isRecord(payload.file)) {
    const nested = coerceUploadResponse(payload.data)
    if (nested?.answer || nested?.message) return nested
  }

  const file = isRecord(payload.file) ? payload.file : undefined
  const text =
    (typeof payload.text === 'string' && payload.text.trim()) ||
    (typeof payload.answer === 'string' && payload.answer.trim()) ||
    (typeof payload.message === 'string' && payload.message.trim()) ||
    (typeof payload.result === 'string' && payload.result.trim()) ||
    (typeof payload.output === 'string' && payload.output.trim()) ||
    undefined

  if (!text && !file) {
    // Objeto sem texto útil — evita resposta vazia no chat
    return null
  }

  return {
    success: typeof payload.success === 'boolean' ? payload.success : true,
    message: text,
    answer: text,
    file: file
      ? {
          id: typeof file.id === 'string' ? file.id : undefined,
          name: typeof file.name === 'string' ? file.name : undefined,
          webUrl: typeof file.webUrl === 'string' ? file.webUrl : undefined,
          path: typeof file.path === 'string' ? file.path : undefined,
          size: typeof file.size === 'number' ? file.size : undefined,
        }
      : undefined,
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
  }
}

/**
 * Envia o arquivo em base64 dentro de um JSON para o webhook upload-onedrive.
 * No n8n: use "Convert to File" / "Move Base64 String to File" com o campo fileBase64.
 */
export async function uploadFileToOneDrive(
  payload: UploadPayload
): Promise<ApiResponse<UploadApiResponse>> {
  const sessionId = payload.metadata.sessionId || payload.conversationId || generateSessionId()
  const mimeType = payload.file.type || 'application/octet-stream'
  const fileBase64 = await fileToBase64(payload.file)

  const jsonPayload = {
    query: payload.query,
    folderPath: payload.folderPath,
    fileName: payload.file.name,
    mimeType,
    fileSize: payload.file.size,
    // Base64 puro (sem data:...) — ideal para Convert to File no n8n
    fileBase64,
    // Alternativa com data URI, se o node preferir
    fileDataUri: `data:${mimeType};base64,${fileBase64}`,
    sessionId,
    session_id: sessionId,
    conversationId: payload.conversationId,
    userId: payload.userId,
    userName: payload.userName,
    userEmail: payload.userEmail,
    userGroups: payload.userGroups,
    userRoles: payload.userRoles,
    timestamp: payload.metadata.timestamp,
  }

  const response = await fetchN8nWithRetry<unknown>(
    getUploadEndpoint(),
    {
      method: 'POST',
      headers: {
        ...buildN8nAuthHeaders(payload.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonPayload),
    },
    1,
    180000
  )

  const uploadData = coerceUploadResponse(response.data)
  if (response.success && uploadData && uploadData.success !== false) {
    return {
      ...response,
      data: uploadData,
    }
  }

  throw new Error(
    response.error ||
    response.message ||
    uploadData?.message ||
    'Erro no upload do arquivo'
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
  if (isLocalTestAccessToken(user.accessToken)) {
    return createApiResponse(createLocalDocumentResults(query))
  }

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
  if (isLocalTestAccessToken(user.accessToken)) {
    return createApiResponse(createLocalHistory())
  }

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
 * Obtém logs de auditoria
 */
export async function getAuditLogs(
  user: UserProfile,
  filters: AuditFilters
): Promise<ApiResponse<{ logs: AuditLog[]; total: number }>> {
  if (isLocalTestAccessToken(user.accessToken)) {
    const logs = readLocalAuditBuffer()
    return createApiResponse({
      logs,
      total: logs.length,
    })
  }

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
  if (isLocalTestAccessToken(user.accessToken)) {
    return createApiResponse(createLocalDashboardStats())
  }

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
  if (isLocalTestAccessToken(user.accessToken)) {
    return createApiResponse(createLocalChartData(period))
  }

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
