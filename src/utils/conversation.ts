import { ChatMessage, Conversation, DocumentSource } from '../types'

export const NEW_CONVERSATION_TITLE = 'Nova conversa'

export function isEmptyDraftConversation(conv: Conversation): boolean {
  return (
    conv.messages.length === 0 &&
    (conv.title === NEW_CONVERSATION_TITLE || conv.title === 'Nova Conversa')
  )
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
  return messages.map((m) => ({
    id: m.id,
    role: (m.role === 'user' || m.role === 'assistant' || m.role === 'system' ? m.role : 'assistant') as ChatMessage['role'],
    content: m.content,
    timestamp: new Date(m.timestamp),
    status: (['sending', 'sent', 'error', 'blocked'].includes(m.status) ? m.status : 'sent') as ChatMessage['status'],
    sources: m.sources?.map((s) => ({
      id: s.id || s.webUrl || s.name || '',
      name: s.name || '',
      path: s.path || '',
      webUrl: s.webUrl || '',
      type: s.type || 'file',
      relevanceScore: s.relevanceScore,
      excerpt: s.excerpt,
      modifiedAt: s.modifiedAt ? new Date(s.modifiedAt) : new Date(),
    })),
    attachment: m.attachment,
  }))
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
