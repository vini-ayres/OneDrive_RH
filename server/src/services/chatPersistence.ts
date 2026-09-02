import { eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  users,
  sessions,
  conversations,
  messages,
  messageSources,
  messageAttachments,
  auditLogs,
  documentAccesses,
} from '../db/schema.js'
import type { ChatCompletedEvent } from '../schemas/events.js'
import type { UserRole } from '../middleware/rbac.js'
import { getHighestRole } from '../middleware/rbac.js'

const MAX_PROCESSING_MS = 10 * 60 * 1000

function parseProcessingMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed)
  }
  return undefined
}

function resolveProcessingMs(
  event: ChatCompletedEvent,
  existingAudit?: { metadata: Record<string, string> | null } | null
): number | undefined {
  const fromEvent = parseProcessingMs(event.assistantMessage.processingMs)
  if (fromEvent != null) return fromEvent

  const fromMeta = parseProcessingMs(existingAudit?.metadata?.processingMs)
  if (fromMeta != null) return fromMeta

  if (!event.userMessage.timestamp) return undefined
  const startedAt = new Date(event.userMessage.timestamp).getTime()
  if (Number.isNaN(startedAt)) return undefined
  const elapsed = Date.now() - startedAt
  if (elapsed < 0 || elapsed > MAX_PROCESSING_MS) return undefined
  return elapsed
}

export interface AiQueryOutcomeInput {
  user: {
    id: string
    userName?: string
    userEmail?: string
    roles: UserRole[]
    groups: string[]
  }
  requestId: string
  conversationId: string
  sessionId?: string
  action: 'chat_query' | 'file_upload'
  result: 'success' | 'error'
  query: string
  processingMs?: number
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
  documentAccessed?: string
  documentPath?: string
}

export async function persistChatCompletedEvent(event: ChatCompletedEvent): Promise<{ duplicate: boolean }> {
  return db.transaction(async (tx) => {
    const existingMessage = await tx
      .select({
        id: messages.id,
        content: messages.content,
        status: messages.status,
        processingMs: messages.processingMs,
      })
      .from(messages)
      .where(eq(messages.requestId, event.requestId))
      .limit(1)

    const existingAudit = await tx
      .select({
        id: auditLogs.id,
        result: auditLogs.result,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(eq(auditLogs.requestId, event.requestId))
      .limit(1)

    const processingMs = resolveProcessingMs(event, existingAudit[0] ?? null)
    if (processingMs != null) {
      event.assistantMessage.processingMs = processingMs
    }

    if (existingMessage.length > 0) {
      const current = existingMessage[0]
      const sameTurn = current.content === event.assistantMessage.content
      const recoveringFromError =
        current.status === 'error' && event.assistantMessage.status !== 'error' && !event.assistantMessage.wasBlocked

      if (sameTurn || recoveringFromError) {
        const nextMetadata = {
          ...(existingAudit[0]?.metadata ?? {}),
          ...(processingMs != null ? { processingMs: String(processingMs) } : {}),
        }

        await tx
          .update(messages)
          .set({
            content: event.assistantMessage.content,
            status: event.assistantMessage.wasBlocked
              ? 'blocked'
              : event.assistantMessage.status,
            processingMs: processingMs ?? current.processingMs,
            blockedReason: event.assistantMessage.blockedReason ?? null,
          })
          .where(eq(messages.id, current.id))

        if (existingAudit[0]) {
          await tx
            .update(auditLogs)
            .set({
              result: recoveringFromError ? event.audit.result : existingAudit[0].result,
              metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : existingAudit[0].metadata,
            })
            .where(eq(auditLogs.id, existingAudit[0].id))
        }

        return { duplicate: true }
      }

      // Timeout no cliente após o n8n já ter persistido sucesso: não duplicar a conversa.
      if (event.assistantMessage.status === 'error' && current.status !== 'error') {
        return { duplicate: true }
      }

      event.requestId = `${event.requestId}:${crypto.randomUUID()}`
    }

    const roles = event.user.roles.filter(Boolean) as UserRole[]
    const now = new Date()

    await tx
      .insert(users)
      .values({
        id: event.user.id,
        username: event.user.id,
        displayName: event.user.userName || event.user.id,
        email: event.user.userEmail || null,
        roles: roles.length > 0 ? roles : ['colaborador'],
        groups: event.user.groups,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: event.user.userName || event.user.id,
          email: event.user.userEmail || null,
          roles: roles.length > 0 ? roles : ['colaborador'],
          groups: event.user.groups,
          lastSeenAt: now,
        },
      })

    const sessionId = event.sessionId
    if (sessionId) {
      await tx
        .insert(sessions)
        .values({
          id: sessionId,
          userId: event.user.id,
          ipAddress: event.audit.ipAddress || null,
          userAgent: event.audit.userAgent || null,
          startedAt: now,
          lastActivity: now,
        })
        .onConflictDoUpdate({
          target: sessions.id,
          set: {
            lastActivity: now,
            ipAddress: event.audit.ipAddress || null,
            userAgent: event.audit.userAgent || null,
          },
        })
    }

    const conversationTitle =
      event.conversationTitle ||
      (event.userMessage.content.slice(0, 60).trim() || 'Nova conversa')

    const [conversation] = await tx
      .insert(conversations)
      .values({
        id: event.conversationId,
        userId: event.user.id,
        title: conversationTitle,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          updatedAt: now,
          title: sql`CASE WHEN ${conversations.title} = 'Nova conversa' THEN ${conversationTitle} ELSE ${conversations.title} END`,
        },
      })
      .returning()

    if (!conversation) {
      throw new Error('Failed to upsert conversation')
    }

    const userMessageTimeRaw = event.userMessage.timestamp
      ? new Date(event.userMessage.timestamp)
      : now
    const userMessageTime = Number.isNaN(userMessageTimeRaw.getTime()) ? now : userMessageTimeRaw
    const assistantMessageTime = new Date(Math.max(now.getTime(), userMessageTime.getTime() + 1))

    const [userMessage] = await tx
      .insert(messages)
      .values({
        conversationId: conversation.id,
        role: 'user',
        content: event.userMessage.content,
        status: 'sent',
        createdAt: userMessageTime,
      })
      .returning()

    if (!userMessage) {
      throw new Error('Failed to insert user message')
    }

    if (event.userMessage.attachment) {
      await tx.insert(messageAttachments).values({
        messageId: userMessage.id,
        name: event.userMessage.attachment.name,
        sizeBytes: event.userMessage.attachment.size ?? null,
        mimeType: event.userMessage.attachment.type ?? null,
        folderPath: event.userMessage.attachment.folderPath ?? null,
      })

      const uploadName = event.userMessage.attachment.name
      await tx
        .insert(documentAccesses)
        .values({
          userId: event.user.id,
          documentId: uploadName,
          name: uploadName,
          path: event.userMessage.attachment.folderPath ?? null,
          webUrl: null,
          docType: event.userMessage.attachment.type ?? null,
          source: 'upload',
          messageId: userMessage.id,
          accessedAt: now,
        })
        .onConflictDoUpdate({
          target: [documentAccesses.userId, documentAccesses.documentId],
          set: {
            accessedAt: now,
            name: uploadName,
            path: event.userMessage.attachment.folderPath ?? null,
            docType: event.userMessage.attachment.type ?? null,
            source: 'upload',
            messageId: userMessage.id,
          },
        })
    }

    const assistantStatus = event.assistantMessage.wasBlocked
      ? 'blocked'
      : event.assistantMessage.status

    const [assistantMessage] = await tx
      .insert(messages)
      .values({
        conversationId: conversation.id,
        role: 'assistant',
        content: event.assistantMessage.content,
        status: assistantStatus,
        requestId: event.requestId,
        processingMs: event.assistantMessage.processingMs ?? null,
        blockedReason: event.assistantMessage.blockedReason ?? null,
        createdAt: assistantMessageTime,
      })
      .returning()

    if (!assistantMessage) {
      throw new Error('Failed to insert assistant message')
    }

    for (const source of event.assistantMessage.sources) {
      const docId = source.id || source.webUrl || source.name || crypto.randomUUID()
      await tx.insert(messageSources).values({
        messageId: assistantMessage.id,
        documentId: docId,
        name: source.name ?? null,
        path: source.path ?? null,
        webUrl: source.webUrl ?? null,
        docType: source.type ?? null,
        relevanceScore: source.relevanceScore ?? null,
        excerpt: source.excerpt ?? null,
      })

      if (source.id || source.name || source.webUrl) {
        await tx
          .insert(documentAccesses)
          .values({
            userId: event.user.id,
            documentId: docId,
            name: source.name ?? null,
            path: source.path ?? null,
            webUrl: source.webUrl ?? null,
            docType: source.type ?? null,
            source: 'chat_source',
            messageId: assistantMessage.id,
            accessedAt: now,
          })
          .onConflictDoUpdate({
            target: [documentAccesses.userId, documentAccesses.documentId],
            set: {
              accessedAt: now,
              name: source.name ?? null,
              path: source.path ?? null,
              webUrl: source.webUrl ?? null,
              docType: source.type ?? null,
              messageId: assistantMessage.id,
            },
          })
      }
    }

    const sourceUrls = [...new Set(
      event.assistantMessage.sources
        .map((source) => source.webUrl?.trim())
        .filter((url): url is string => Boolean(url))
    )]
    const documentPath =
      event.audit.documentPath ??
      event.assistantMessage.sources.find((source) => source.path)?.path ??
      event.userMessage.attachment?.folderPath

    const auditMetadata: Record<string, string> = {
      ...(event.metadata ?? {}),
      ...(processingMs != null ? { processingMs: String(processingMs) } : {}),
      ...(sourceUrls[0] ? { documentUrl: sourceUrls[0] } : {}),
      ...(sourceUrls.length > 1 ? { documentUrls: JSON.stringify(sourceUrls) } : {}),
    }

    const auditForRequest = existingAudit[0] && existingMessage.length === 0
      ? existingAudit[0]
      : (
          await tx
            .select({
              id: auditLogs.id,
              result: auditLogs.result,
              metadata: auditLogs.metadata,
            })
            .from(auditLogs)
            .where(eq(auditLogs.requestId, event.requestId))
            .limit(1)
        )[0]

    if (auditForRequest) {
      await tx
        .update(auditLogs)
        .set({
          result: event.audit.result,
          documentAccessed: event.audit.documentAccessed ?? null,
          documentPath: documentPath ?? null,
          metadata: {
            ...(auditForRequest.metadata ?? {}),
            ...auditMetadata,
          },
        })
        .where(eq(auditLogs.id, auditForRequest.id))
    } else {
      await tx.insert(auditLogs).values({
        userId: event.user.id,
        userName: event.user.userName ?? null,
        userEmail: event.user.userEmail ?? null,
        role: getHighestRole(roles.length > 0 ? roles : ['colaborador']),
        action: event.audit.action,
        query: event.userMessage.content,
        documentAccessed: event.audit.documentAccessed ?? null,
        documentPath: documentPath ?? null,
        result: event.audit.result,
        ipAddress: event.audit.ipAddress ?? null,
        userAgent: event.audit.userAgent ?? null,
        sessionId: sessionId || null,
        requestId: event.requestId,
        metadata: Object.keys(auditMetadata).length > 0 ? auditMetadata : null,
      })
    }

    return { duplicate: false }
  })
}

export async function recordAiQueryOutcome(input: AiQueryOutcomeInput): Promise<{ duplicate: boolean }> {
  if (input.result === 'error') {
    return persistChatCompletedEvent({
      requestId: input.requestId,
      conversationId: input.conversationId,
      sessionId: input.sessionId || input.requestId,
      user: {
        id: input.user.id,
        userName: input.user.userName,
        userEmail: input.user.userEmail,
        roles: input.user.roles,
        groups: input.user.groups,
      },
      userMessage: {
        content: input.query,
      },
      assistantMessage: {
        content: input.errorMessage || 'Falha na consulta da IA.',
        status: 'error',
        sources: [],
        processingMs: input.processingMs,
      },
      audit: {
        action: input.action,
        result: 'error',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        documentAccessed: input.documentAccessed,
        documentPath: input.documentPath,
      },
      metadata: input.processingMs != null ? { processingMs: String(input.processingMs) } : undefined,
    })
  }

  return applyAiQueryMetrics(input)
}

async function applyAiQueryMetrics(input: AiQueryOutcomeInput): Promise<{ duplicate: boolean }> {
  const processingMs = parseProcessingMs(input.processingMs)
  const now = new Date()
  const roles = input.user.roles.length > 0 ? input.user.roles : (['colaborador'] as UserRole[])

  if (processingMs != null) {
    await db
      .update(messages)
      .set({ processingMs })
      .where(eq(messages.requestId, input.requestId))
  }

  const [existingAudit] = await db
    .select({
      id: auditLogs.id,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(eq(auditLogs.requestId, input.requestId))
    .limit(1)

  if (existingAudit) {
    if (processingMs != null) {
      await db
        .update(auditLogs)
        .set({
          metadata: {
            ...(existingAudit.metadata ?? {}),
            processingMs: String(processingMs),
          },
        })
        .where(eq(auditLogs.id, existingAudit.id))
    }
    return { duplicate: true }
  }

  await db
    .insert(users)
    .values({
      id: input.user.id,
      username: input.user.id,
      displayName: input.user.userName || input.user.id,
      email: input.user.userEmail || null,
      roles,
      groups: input.user.groups,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: input.user.userName || input.user.id,
        email: input.user.userEmail || null,
        lastSeenAt: now,
      },
    })

  await db.insert(auditLogs).values({
    userId: input.user.id,
    userName: input.user.userName ?? null,
    userEmail: input.user.userEmail ?? null,
    role: getHighestRole(roles),
    action: input.action,
    query: input.query,
    documentAccessed: input.documentAccessed ?? null,
    documentPath: input.documentPath ?? null,
    result: 'success',
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    sessionId: input.sessionId || null,
    requestId: input.requestId,
    metadata: processingMs != null ? { processingMs: String(processingMs) } : null,
  })

  return { duplicate: false }
}

export async function recordDocumentAccess(
  userId: string,
  event: {
    documentId: string
    name?: string
    path?: string
    webUrl?: string
    docType?: string
    source: string
  }
) {
  const now = new Date()

  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  await db
    .insert(documentAccesses)
    .values({
      userId,
      documentId: event.documentId,
      name: event.name ?? null,
      path: event.path ?? null,
      webUrl: event.webUrl ?? null,
      docType: event.docType ?? null,
      source: event.source,
      accessedAt: now,
    })
    .onConflictDoUpdate({
      target: [documentAccesses.userId, documentAccesses.documentId],
      set: {
        accessedAt: now,
        name: event.name ?? null,
        path: event.path ?? null,
        webUrl: event.webUrl ?? null,
        docType: event.docType ?? null,
        source: event.source,
      },
    })

  await db.insert(auditLogs).values({
    userId,
    userName: userRow?.displayName ?? null,
    userEmail: userRow?.email ?? null,
    role: userRow?.roles?.[0] ?? 'colaborador',
    action: 'document_open',
    query: event.name || event.documentId,
    documentAccessed: event.name ?? null,
    documentPath: event.path ?? null,
    result: 'success',
    metadata: event.webUrl ? { documentUrl: event.webUrl } : null,
  })
}

function messageTime(value: Date): number {
  const time = value.getTime()
  return Number.isNaN(time) ? 0 : time
}

function sortByTimestamp<T extends { role: string; timestamp: Date }>(messages: T[]): T[] {
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

function stabilizeMessageOrder<T extends { role: string; timestamp: Date }>(messages: T[]): T[] {
  const sorted = sortByTimestamp(messages)
  if (!isFullyInvertedTurns(sorted)) return sorted

  const repaired: T[] = []
  for (let i = 0; i < sorted.length; i += 2) {
    repaired.push(sorted[i + 1], sorted[i])
  }
  return repaired
}

export async function getConversationList(userId: string) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      isFavorite: conversations.isFavorite,
      updatedAt: conversations.updatedAt,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(sql`${conversations.updatedAt} DESC`)
}

export async function getConversationMessages(conversationId: string, userId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  if (!conversation) return null

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(
      sql`${messages.createdAt} ASC`,
      sql`CASE WHEN ${messages.role} = 'user' THEN 0 WHEN ${messages.role} = 'assistant' THEN 1 ELSE 2 END`,
      messages.id
    )

  const result = []

  for (const msg of msgs) {
    const sources = await db
      .select()
      .from(messageSources)
      .where(eq(messageSources.messageId, msg.id))

    const attachments = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, msg.id))

    result.push({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt,
      status: msg.status,
      sources: sources.map((s) => ({
        id: s.documentId || s.id,
        name: s.name || '',
        path: s.path || '',
        webUrl: s.webUrl || '',
        type: s.docType || '',
        relevanceScore: s.relevanceScore ?? undefined,
        excerpt: s.excerpt ?? undefined,
      })),
      attachment: attachments[0]
        ? {
            name: attachments[0].name || '',
            size: attachments[0].sizeBytes || 0,
            type: attachments[0].mimeType || '',
            folderPath: attachments[0].folderPath ?? undefined,
          }
        : undefined,
      blockedReason: msg.blockedReason ?? undefined,
    })
  }

  return {
    conversation,
    messages: stabilizeMessageOrder(result),
  }
}

export async function updateConversation(
  conversationId: string,
  userId: string,
  updates: { title?: string; isFavorite?: boolean }
) {
  const [updated] = await db
    .update(conversations)
    .set({
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.isFavorite !== undefined ? { isFavorite: updates.isFavorite } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning()

  return updated ?? null
}

export async function deleteConversation(conversationId: string, userId: string) {
  const [owned] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  if (!owned) return false

  const messageRows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))

  const messageIds = messageRows.map((row) => row.id)
  if (messageIds.length > 0) {
    await db
      .update(documentAccesses)
      .set({ messageId: null })
      .where(inArray(documentAccesses.messageId, messageIds))
  }

  const deleted = await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning({ id: conversations.id })

  return deleted.length > 0
}
