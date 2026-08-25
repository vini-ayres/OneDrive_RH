import { z } from 'zod'
import type { UserRole } from '../middleware/rbac.js'

const VALID_ROLES: UserRole[] = ['colaborador', 'gestor', 'rh', 'diretoria', 'admin']

const documentSourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  webUrl: z.string().optional(),
  type: z.string().optional(),
  relevanceScore: z.number().optional(),
  excerpt: z.string().optional(),
})

/** Schema estrito após normalização */
export const chatCompletedEventSchema = z.object({
  requestId: z.string().min(1),
  conversationId: z.string().min(1),
  sessionId: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    roles: z.array(z.string()).default([]),
    groups: z.array(z.string()).default([]),
  }),
  userMessage: z.object({
    content: z.string(),
    timestamp: z.string().datetime().optional(),
    attachment: z
      .object({
        name: z.string(),
        size: z.number().optional(),
        type: z.string().optional(),
        folderPath: z.string().optional(),
      })
      .optional(),
  }),
  assistantMessage: z.object({
    content: z.string(),
    status: z.enum(['sending', 'sent', 'error', 'blocked']).default('sent'),
    sources: z.array(documentSourceSchema).default([]),
    processingMs: z.number().optional(),
    blockedReason: z.string().optional(),
    wasBlocked: z.boolean().optional(),
  }),
  audit: z.object({
    action: z.enum(['chat_query', 'file_upload', 'document_open']),
    result: z.enum(['success', 'blocked', 'error', 'denied']),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    documentAccessed: z.string().optional(),
    documentPath: z.string().optional(),
  }),
  metadata: z.record(z.string()).optional(),
  conversationTitle: z.string().optional(),
})

export type ChatCompletedEvent = z.infer<typeof chatCompletedEventSchema>

/** Aceita qualquer JSON enviado pelo n8n — campos extras são ignorados */
export const chatCompletedEventLooseSchema = z
  .object({
    requestId: z.unknown().optional(),
    conversationId: z.unknown().optional(),
    sessionId: z.unknown().optional(),
    userId: z.unknown().optional(),
    userName: z.unknown().optional(),
    userEmail: z.unknown().optional(),
    query: z.unknown().optional(),
    answer: z.unknown().optional(),
    user: z
      .object({
        id: z.unknown().optional(),
        userName: z.unknown().optional(),
        userEmail: z.unknown().optional(),
        roles: z.unknown().optional(),
        groups: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    userMessage: z
      .object({
        content: z.unknown().optional(),
        timestamp: z.unknown().optional(),
        attachment: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    assistantMessage: z
      .object({
        content: z.unknown().optional(),
        status: z.unknown().optional(),
        sources: z.unknown().optional(),
        processingMs: z.unknown().optional(),
        blockedReason: z.unknown().optional(),
        wasBlocked: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    audit: z
      .object({
        action: z.unknown().optional(),
        result: z.unknown().optional(),
        ipAddress: z.unknown().optional(),
        userAgent: z.unknown().optional(),
        documentAccessed: z.unknown().optional(),
        documentPath: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    metadata: z.unknown().optional(),
    conversationTitle: z.unknown().optional(),
  })
  .passthrough()

export type ChatCompletedEventLoose = z.infer<typeof chatCompletedEventLooseSchema>

/** Remove prefixo "=" que o n8n deixa quando a expressão falha */
export function stripN8nValue(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed || trimmed === '=') return undefined
  return trimmed.startsWith('=') ? trimmed.slice(1).trim() || undefined : trimmed
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => stripN8nValue(item)).filter((item): item is string => Boolean(item))
  }

  const single = stripN8nValue(value)
  if (!single) return []
  if (single.includes(',')) {
    return single.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return [single]
}

function coerceRoles(value: unknown): UserRole[] {
  const raw = coerceStringArray(value)
  const roles = raw.filter((r): r is UserRole => VALID_ROLES.includes(r as UserRole))
  return roles.length > 0 ? roles : ['colaborador']
}

function normalizeAttachment(
  value: unknown
): ChatCompletedEvent['userMessage']['attachment'] | undefined {
  if (value == null) return undefined

  if (typeof value === 'string') {
    const name = stripN8nValue(value)
    return name ? { name } : undefined
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const name = stripN8nValue(obj.name) ?? stripN8nValue(obj.fileName)
    if (!name) return undefined
    return {
      name,
      size: typeof obj.size === 'number' ? obj.size : undefined,
      type: stripN8nValue(obj.type) ?? stripN8nValue(obj.mimeType),
      folderPath: stripN8nValue(obj.folderPath),
    }
  }

  return undefined
}

function extractSourcesFromMarkdown(content: string): ChatCompletedEvent['assistantMessage']['sources'] {
  const sources: ChatCompletedEvent['assistantMessage']['sources'] = []
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim()
    const webUrl = match[2].trim()
    sources.push({
      id: webUrl,
      name,
      webUrl,
      path: '',
      type: 'file',
    })
  }

  return sources
}

function parseTimestamp(value: unknown): string | undefined {
  const raw = stripN8nValue(value)
  if (!raw) return undefined
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function inferAuditAction(
  attachment: ChatCompletedEvent['userMessage']['attachment'],
  explicit?: unknown
): ChatCompletedEvent['audit']['action'] {
  const action = stripN8nValue(explicit)
  if (action === 'chat_query' || action === 'file_upload' || action === 'document_open') {
    return action
  }
  return attachment ? 'file_upload' : 'chat_query'
}

function inferAuditResult(explicit: unknown, wasBlocked?: boolean): ChatCompletedEvent['audit']['result'] {
  if (wasBlocked) return 'blocked'
  const result = stripN8nValue(explicit)
  if (result === 'success' || result === 'blocked' || result === 'error' || result === 'denied') {
    return result
  }
  return 'success'
}

/**
 * Converte payload mínimo do n8n para o formato interno da API.
 * Campos obrigatórios após normalização: conversationId, user.id, userMessage.content, assistantMessage.content
 */
export function normalizeChatCompletedEvent(raw: ChatCompletedEventLoose): ChatCompletedEvent {
  const conversationId =
    stripN8nValue(raw.conversationId) ??
    stripN8nValue(raw.sessionId) ??
    crypto.randomUUID()

  const sessionId =
    stripN8nValue(raw.sessionId) ??
    stripN8nValue(raw.requestId) ??
    conversationId

  const requestId =
    stripN8nValue(raw.requestId) ??
    sessionId

  const userId =
    stripN8nValue(raw.user?.id) ??
    stripN8nValue(raw.userId) ??
    'anonymous'

  const userMessageContent =
    stripN8nValue(raw.userMessage?.content) ??
    stripN8nValue(raw.query) ??
    ''

  const assistantContent =
    stripN8nValue(raw.assistantMessage?.content) ??
    stripN8nValue(raw.answer) ??
    ''

  if (!userMessageContent) {
    throw new Error('userMessage.content (ou query) é obrigatório')
  }
  if (!assistantContent) {
    throw new Error('assistantMessage.content (ou answer) é obrigatório')
  }

  const attachment = normalizeAttachment(raw.userMessage?.attachment)

  const explicitSources = Array.isArray(raw.assistantMessage?.sources)
    ? raw.assistantMessage.sources
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
        .map((s) => ({
          id: stripN8nValue(s.id),
          name: stripN8nValue(s.name),
          path: stripN8nValue(s.path),
          webUrl: stripN8nValue(s.webUrl),
          type: stripN8nValue(s.type),
        }))
    : []

  const markdownSources = extractSourcesFromMarkdown(assistantContent)
  const sources = explicitSources.length > 0 ? explicitSources : markdownSources

  const wasBlocked = raw.assistantMessage?.wasBlocked === true
  const statusRaw = stripN8nValue(raw.assistantMessage?.status)
  const status =
    wasBlocked || statusRaw === 'blocked'
      ? 'blocked'
      : statusRaw === 'error'
        ? 'error'
        : statusRaw === 'sending'
          ? 'sending'
          : 'sent'

  const documentAccessed =
    stripN8nValue(raw.audit?.documentAccessed) ??
    attachment?.name ??
    sources[0]?.name

  const normalized: ChatCompletedEvent = {
    requestId,
    conversationId,
    sessionId,
    user: {
      id: userId,
      userName:
        stripN8nValue(raw.user?.userName) ??
        stripN8nValue(raw.userName) ??
        userId,
      userEmail:
        stripN8nValue(raw.user?.userEmail) ??
        stripN8nValue(raw.userEmail),
      roles: coerceRoles(raw.user?.roles),
      groups: coerceStringArray(raw.user?.groups).filter((g) => g !== '='),
    },
    userMessage: {
      content: userMessageContent,
      timestamp: parseTimestamp(raw.userMessage?.timestamp),
      attachment,
    },
    assistantMessage: {
      content: assistantContent,
      status,
      sources,
      processingMs:
        typeof raw.assistantMessage?.processingMs === 'number'
          ? raw.assistantMessage.processingMs
          : undefined,
      blockedReason: stripN8nValue(raw.assistantMessage?.blockedReason),
      wasBlocked,
    },
    audit: {
      action: inferAuditAction(attachment, raw.audit?.action),
      result: inferAuditResult(raw.audit?.result, wasBlocked),
      ipAddress: stripN8nValue(raw.audit?.ipAddress),
      userAgent: stripN8nValue(raw.audit?.userAgent),
      documentAccessed,
      documentPath: stripN8nValue(raw.audit?.documentPath),
    },
    conversationTitle: stripN8nValue(raw.conversationTitle),
  }

  if (typeof raw.metadata === 'object' && raw.metadata !== null && !Array.isArray(raw.metadata)) {
    const meta: Record<string, string> = {}
    for (const [key, val] of Object.entries(raw.metadata as Record<string, unknown>)) {
      const s = stripN8nValue(val)
      if (s) meta[key] = s
    }
    if (Object.keys(meta).length > 0) normalized.metadata = meta
  }

  return chatCompletedEventSchema.parse(normalized)
}
