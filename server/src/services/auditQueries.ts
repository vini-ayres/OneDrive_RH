import { eq, and, gte, lte, desc, count, ilike, or, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { auditLogs, messages, messageSources, documentAccesses } from '../db/schema.js'
import { excludeTestUserFromAudit } from './excludedUsers.js'

export interface AuditQueryFilters {
  userId?: string
  startDate?: Date
  endDate?: Date
  result?: string
  documentName?: string
  limit?: number
  offset?: number
}

function buildAuditConditions(filters: AuditQueryFilters, includeResult = true) {
  const conditions = [excludeTestUserFromAudit()]

  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId))
  }
  if (filters.startDate) {
    conditions.push(gte(auditLogs.createdAt, filters.startDate))
  }
  if (filters.endDate) {
    conditions.push(lte(auditLogs.createdAt, filters.endDate))
  }
  if (includeResult && filters.result) {
    conditions.push(eq(auditLogs.result, filters.result))
  }
  if (filters.documentName) {
    const term = `%${filters.documentName}%`
    conditions.push(
      or(
        ilike(auditLogs.documentAccessed, term),
        ilike(auditLogs.query, term),
        ilike(auditLogs.userName, term)
      )
    )
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

function uniqueUrls(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const value of values) {
    const url = value?.trim()
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}

function urlsFromMetadata(metadata?: Record<string, string> | null): string[] {
  if (!metadata) return []
  const parsed: string[] = []
  if (metadata.documentUrls) {
    try {
      const raw = JSON.parse(metadata.documentUrls) as unknown
      if (Array.isArray(raw)) {
        parsed.push(...raw.filter((item): item is string => typeof item === 'string'))
      }
    } catch {
      // ignore
    }
  }
  return uniqueUrls([...parsed, metadata.documentUrl])
}

export async function queryAuditLogs(filters: AuditQueryFilters) {
  const whereClause = buildAuditConditions(filters)
  const summaryWhere = buildAuditConditions(filters, false)

  const [totalResult] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(whereClause)

  const resultCounts = await db
    .select({
      result: auditLogs.result,
      action: auditLogs.action,
      count: count(),
    })
    .from(auditLogs)
    .where(summaryWhere)
    .groupBy(auditLogs.result, auditLogs.action)

  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)

  const requestIds = [...new Set(logs.map((log) => log.requestId).filter((id): id is string => Boolean(id)))]
  const linksByRequestId = new Map<string, Array<{ url: string; name: string }>>()

  if (requestIds.length > 0) {
    const sourceRows = await db
      .select({
        requestId: messages.requestId,
        webUrl: messageSources.webUrl,
        name: messageSources.name,
      })
      .from(messageSources)
      .innerJoin(messages, eq(messageSources.messageId, messages.id))
      .where(inArray(messages.requestId, requestIds))

    for (const row of sourceRows) {
      if (!row.requestId) continue
      const url = row.webUrl?.trim()
      if (!url || !/^https?:\/\//i.test(url)) continue
      const current = linksByRequestId.get(row.requestId) ?? []
      if (current.some((item) => item.url === url)) continue
      current.push({ url, name: row.name?.trim() || '' })
      linksByRequestId.set(row.requestId, current)
    }
  }

  const openLogs = logs.filter((log) => log.action === 'document_open')
  const urlsByOpenKey = new Map<string, string[]>()
  if (openLogs.length > 0) {
    const userIds = [...new Set(openLogs.map((log) => log.userId))]
    const accessRows = await db
      .select({
        userId: documentAccesses.userId,
        name: documentAccesses.name,
        documentId: documentAccesses.documentId,
        webUrl: documentAccesses.webUrl,
      })
      .from(documentAccesses)
      .where(inArray(documentAccesses.userId, userIds))

    for (const row of accessRows) {
      const keys = [row.name, row.documentId].filter((value): value is string => Boolean(value))
      for (const key of keys) {
        const mapKey = `${row.userId}::${key.toLowerCase()}`
        const current = urlsByOpenKey.get(mapKey) ?? []
        urlsByOpenKey.set(mapKey, uniqueUrls([...current, row.webUrl]))
      }
    }
  }

  const counts = {
    success: 0,
    error: 0,
    total: 0,
  }

  for (const row of resultCounts) {
    counts.total += row.count
    const isAiQuery = row.action === 'chat_query' || row.action === 'file_upload'
    if (isAiQuery && row.result === 'success') counts.success += row.count
    if (isAiQuery && row.result === 'error') counts.error += row.count
  }

  return {
    logs: logs.map((log) => {
      const fromSources = log.requestId ? linksByRequestId.get(log.requestId) ?? [] : []
      const openKey = log.documentAccessed
        ? `${log.userId}::${log.documentAccessed.toLowerCase()}`
        : ''
      const fromAccess = openKey ? urlsByOpenKey.get(openKey) ?? [] : []
      const documentUrls = uniqueUrls([
        ...urlsFromMetadata(log.metadata),
        ...fromSources.map((item) => item.url),
        ...fromAccess,
      ])

      return {
        id: log.id,
        userId: log.userId,
        userName: log.userName || '',
        userEmail: log.userEmail || '',
        action: log.action,
        query: log.query || '',
        documentAccessed: log.documentAccessed ?? undefined,
        documentPath: log.documentPath ?? undefined,
        documentUrl: documentUrls[0],
        documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
        documentLinks: documentUrls.length
          ? documentUrls.map((url, index) => {
              const named = fromSources.find((item) => item.url === url)
              const fallbackName = index === 0 ? log.documentAccessed : named?.name
              const looksLikeUrl = Boolean(fallbackName && /^https?:\/\//i.test(fallbackName))
              const name =
                named?.name && !/^https?:\/\//i.test(named.name)
                  ? named.name
                  : fallbackName && !looksLikeUrl
                    ? fallbackName
                    : undefined
              return { url, name: name || '' }
            })
          : undefined,
        result: log.result as 'success' | 'blocked' | 'error' | 'denied',
        ipAddress: log.ipAddress || '',
        userAgent: log.userAgent || '',
        timestamp: log.createdAt,
        sessionId: log.sessionId || '',
        role: log.role || 'colaborador',
        metadata: log.metadata ?? undefined,
      }
    }),
    total: totalResult?.count ?? 0,
    counts,
  }
}

export async function purgeAuditLogsOlderThan(cutoffDate: Date): Promise<number> {
  const result = await db
    .delete(auditLogs)
    .where(lte(auditLogs.createdAt, cutoffDate))
    .returning({ id: auditLogs.id })

  return result.length
}
