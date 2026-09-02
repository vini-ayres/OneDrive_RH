import { ChatMessage, Conversation, DocumentSource } from '../types'

export const NEW_CONVERSATION_TITLE = 'Nova conversa'

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g

export function isEmptyDraftConversation(conv: Conversation): boolean {
  return (
    conv.messages.length === 0 &&
    (conv.title === NEW_CONVERSATION_TITLE || conv.title === 'Nova Conversa')
  )
}

export function extractMarkdownSources(content: string): DocumentSource[] {
  if (!content) return []

  const sources: DocumentSource[] = []
  const seen = new Set<string>()
  const regex = new RegExp(MARKDOWN_LINK_RE.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim()
    const webUrl = match[2].trim()
    if (!webUrl || seen.has(webUrl)) continue
    seen.add(webUrl)
    sources.push({
      id: webUrl,
      name: name || webUrl,
      path: '',
      webUrl,
      type: 'file',
      modifiedAt: new Date(),
    })
  }

  return sources
}

function messageTime(value: Date | string | number): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function sortByTimestamp<T extends { role: string; timestamp: Date | string }>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    const dt = messageTime(a.timestamp) - messageTime(b.timestamp)
    if (dt !== 0) return dt
    if (a.role === 'user' && b.role !== 'user') return -1
    if (a.role !== 'user' && b.role === 'user') return 1
    return 0
  })
}

function isFullyInvertedTurns<T extends { role: string }>(messages: T[]): boolean {
  if (messages.length < 2 || messages.length % 2 !== 0) return false
  for (let i = 0; i < messages.length; i += 2) {
    if (messages[i].role !== 'assistant' || messages[i + 1].role !== 'user') return false
  }
  return true
}

/**
 * Garante pergunta → resposta quando timestamps iguais ou o histórico inteiro veio invertido.
 */
export function stabilizeMessageOrder<T extends { role: string; timestamp: Date | string }>(
  messages: T[]
): T[] {
  const sorted = sortByTimestamp(messages)
  if (!isFullyInvertedTurns(sorted)) return sorted

  const repaired: T[] = []
  for (let i = 0; i < sorted.length; i += 2) {
    repaired.push(sorted[i + 1], sorted[i])
  }
  return repaired
}

export interface ApiConversationMessage {
  id: string
  role: string
  content: string
  timestamp: string
  status: string
  sources?: Array<Partial<DocumentSource> & { id?: string; modifiedAt?: string | Date }>
  attachment?: ChatMessage['attachment']
  blockedReason?: string
}

export interface ApiConversationRecord {
  id: string
  title: string
  isFavorite: boolean
  userId: string
  createdAt: string
  updatedAt: string
}

export function mapApiMessages(messages: ApiConversationMessage[]): ChatMessage[] {
  const mapped = messages.map((m) => {
    const sourcesFromApi = (m.sources || [])
      .map((s) => ({
        id: s.id || s.webUrl || s.name || '',
        name: s.name || '',
        path: s.path || '',
        webUrl: s.webUrl || '',
        type: s.type || 'file',
        relevanceScore: s.relevanceScore,
        excerpt: s.excerpt,
        modifiedAt: s.modifiedAt ? new Date(s.modifiedAt) : new Date(),
      }))
      .filter((s) => s.name || s.webUrl)

    return {
      id: m.id,
      role: (m.role === 'user' || m.role === 'assistant' || m.role === 'system' ? m.role : 'assistant') as ChatMessage['role'],
      content: m.content,
      timestamp: new Date(m.timestamp),
      status: (['sending', 'sent', 'error', 'blocked'].includes(m.status) ? m.status : 'sent') as ChatMessage['status'],
      sources: sourcesFromApi.length > 0 ? sourcesFromApi : extractMarkdownSources(m.content),
      attachment: m.attachment,
    }
  })

  return stabilizeMessageOrder(mapped)
}

export function mapApiConversation(
  conversation: ApiConversationRecord,
  messages: ApiConversationMessage[],
  fallback?: Conversation
): Conversation {
  return {
    id: conversation.id,
    title: conversation.title || fallback?.title || NEW_CONVERSATION_TITLE,
    messages: mapApiMessages(messages),
    createdAt: conversation.createdAt ? new Date(conversation.createdAt) : fallback?.createdAt || new Date(),
    updatedAt: conversation.updatedAt ? new Date(conversation.updatedAt) : fallback?.updatedAt || new Date(),
    isFavorite: conversation.isFavorite ?? fallback?.isFavorite ?? false,
    userId: conversation.userId || fallback?.userId || '',
  }
}
