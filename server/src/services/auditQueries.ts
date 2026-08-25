import { eq, and, gte, lte, desc, sql, count, ilike } from 'drizzle-orm'
import { db } from '../db/client.js'
import { auditLogs } from '../db/schema.js'

export interface AuditQueryFilters {
  userId?: string
  startDate?: Date
  endDate?: Date
  result?: string
  documentName?: string
  limit?: number
  offset?: number
}

export async function queryAuditLogs(filters: AuditQueryFilters) {
  const conditions = []

  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId))
  }
  if (filters.startDate) {
    conditions.push(gte(auditLogs.createdAt, filters.startDate))
  }
  if (filters.endDate) {
    conditions.push(lte(auditLogs.createdAt, filters.endDate))
  }
  if (filters.result) {
    conditions.push(eq(auditLogs.result, filters.result))
  }
  if (filters.documentName) {
    conditions.push(ilike(auditLogs.documentAccessed, `%${filters.documentName}%`))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalResult] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(whereClause)

  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)

  return {
    logs: logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.userName || '',
      userEmail: log.userEmail || '',
      action: log.action,
      query: log.query || '',
      documentAccessed: log.documentAccessed ?? undefined,
      documentPath: log.documentPath ?? undefined,
      result: log.result as 'success' | 'blocked' | 'error' | 'denied',
      ipAddress: log.ipAddress || '',
      userAgent: log.userAgent || '',
      timestamp: log.createdAt,
      sessionId: log.sessionId || '',
      role: log.role || 'colaborador',
      metadata: log.metadata ?? undefined,
    })),
    total: totalResult?.count ?? 0,
  }
}

export async function purgeAuditLogsOlderThan(cutoffDate: Date): Promise<number> {
  const result = await db
    .delete(auditLogs)
    .where(lte(auditLogs.createdAt, cutoffDate))
    .returning({ id: auditLogs.id })

  return result.length
}
