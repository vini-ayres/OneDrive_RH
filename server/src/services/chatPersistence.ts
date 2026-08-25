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

export async function persistChatCompletedEvent(event: ChatCompletedEvent): Promise<{ duplicate: boolean }> {
  return db.transaction(async (tx) => {
    const existingMessage = await tx
      .select({ id: messages.id, content: messages.content })
      .from(messages)
      .where(eq(messages.requestId, event.requestId))
      .limit(1)

    if (existingMessage.length > 0) {
      const sameTurn = existingMessage[0].content === event.assistantMessage.content
      if (sameTurn) {
        return { duplicate: true }
      }
      event.requestId = `${event.requestId}:${crypto.randomUUID()}`
    }

    const existingAudit = await tx
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.requestId, event.requestId))
      .limit(1)

    if (existingAudit.length > 0) {
      return { duplicate: true }
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

    const userMessageTime = event.userMessage.timestamp
      ? new Date(event.userMessage.timestamp)
      : now

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
        createdAt: now,
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

    await tx.insert(auditLogs).values({
      userId: event.user.id,
      userName: event.user.userName ?? null,
      userEmail: event.user.userEmail ?? null,
      role: getHighestRole(roles.length > 0 ? roles : ['colaborador']),
      action: event.audit.action,
      query: event.userMessage.content,
      documentAccessed: event.audit.documentAccessed ?? null,
      documentPath: event.audit.documentPath ?? null,
      result: event.audit.result,
      ipAddress: event.audit.ipAddress ?? null,
      userAgent: event.audit.userAgent ?? null,
      sessionId: sessionId || null,
      requestId: event.requestId,
      metadata: event.metadata ?? null,
    })

    return { duplicate: false }
  })
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
  })
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
    .orderBy(messages.createdAt)

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
    messages: result,
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
