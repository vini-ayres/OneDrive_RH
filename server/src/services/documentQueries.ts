import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { conversations, documentAccesses, messageAttachments, messages, messageSources } from '../db/schema.js'

type RecentDoc = {
  id: string
  name: string
  type: string
  folder: string
  modifiedAt: Date
  webUrl: string
  source: string
}

function inferFileType(name?: string | null, fallback?: string | null): string {
  const extension = name?.split('.').pop()?.toLowerCase()
  if (extension && name && extension !== name.toLowerCase() && extension.length <= 5) {
    return extension
  }

  if (fallback && fallback !== 'file') {
    if (fallback.includes('/')) {
      const mimeExt = fallback.split('/').pop()
      if (mimeExt === 'vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
      if (mimeExt === 'vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
      if (mimeExt === 'vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx'
      if (mimeExt === 'msword') return 'doc'
      if (mimeExt === 'pdf') return 'pdf'
      return mimeExt || fallback
    }
    return fallback
  }

  return extension || 'file'
}

function folderFromPath(path?: string | null, webUrl?: string | null): string {
  if (path) {
    const parts = path.split('/').filter(Boolean)
    if (parts.length > 1) return parts.slice(0, -1).join('/')
    if (parts.length === 1 && path.includes('/')) return parts[0]
  }
  if (webUrl) {
    try {
      const url = new URL(webUrl)
      const segments = url.pathname.split('/').filter(Boolean)
      return segments.slice(0, -1).slice(-2).join('/') || url.hostname
    } catch {
      return ''
    }
  }
  return ''
}

function upsertDoc(map: Map<string, RecentDoc>, doc: RecentDoc) {
  const key = (doc.webUrl || doc.id || doc.name).toLowerCase()
  if (!key) return
  const existing = map.get(key)
  if (!existing || doc.modifiedAt > existing.modifiedAt) {
    map.set(key, doc)
  }
}

export async function getRecentDocuments(userId: string, limit = 50) {
  const [accessRows, citedRows, uploadRows] = await Promise.all([
    db
      .select()
      .from(documentAccesses)
      .where(eq(documentAccesses.userId, userId))
      .orderBy(desc(documentAccesses.accessedAt))
      .limit(limit),
    db
      .select({
        documentId: messageSources.documentId,
        name: messageSources.name,
        path: messageSources.path,
        webUrl: messageSources.webUrl,
        docType: messageSources.docType,
        accessedAt: messages.createdAt,
      })
      .from(messageSources)
      .innerJoin(messages, eq(messageSources.messageId, messages.id))
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(limit),
    db
      .select({
        name: messageAttachments.name,
        path: messageAttachments.folderPath,
        mimeType: messageAttachments.mimeType,
        accessedAt: messages.createdAt,
      })
      .from(messageAttachments)
      .innerJoin(messages, eq(messageAttachments.messageId, messages.id))
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(limit),
  ])

  const merged = new Map<string, RecentDoc>()

  for (const row of accessRows) {
    const name = row.name || row.documentId
    upsertDoc(merged, {
      id: row.documentId,
      name,
      type: inferFileType(name, row.docType),
      folder: folderFromPath(row.path, row.webUrl),
      modifiedAt: row.accessedAt,
      webUrl: row.webUrl || '',
      source: row.source,
    })
  }

  for (const row of citedRows) {
    const name = row.name || row.documentId || 'Documento'
    const id = row.documentId || row.webUrl || name
    upsertDoc(merged, {
      id,
      name,
      type: inferFileType(name, row.docType),
      folder: folderFromPath(row.path, row.webUrl),
      modifiedAt: row.accessedAt,
      webUrl: row.webUrl || '',
      source: 'chat_source',
    })
  }

  for (const row of uploadRows) {
    if (!row.name) continue
    upsertDoc(merged, {
      id: row.name,
      name: row.name,
      type: inferFileType(row.name, row.mimeType),
      folder: folderFromPath(row.path, null),
      modifiedAt: row.accessedAt,
      webUrl: '',
      source: 'upload',
    })
  }

  return [...merged.values()]
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
    .slice(0, limit)
}
