import { eq, and, gte, sql, count, avg } from 'drizzle-orm'
import { db } from '../db/client.js'
import { auditLogs, sessions, documentAccesses, messages } from '../db/schema.js'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getDashboardStats() {
  const today = startOfDay(new Date())
  const monthStart = startOfMonth(new Date())
  const activeThreshold = new Date(Date.now() - 30 * 60 * 1000)

  const [queriesToday] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.createdAt, today),
        sql`${auditLogs.action} IN ('chat_query', 'file_upload')`
      )
    )

  const [activeUsers] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${sessions.userId})` })
    .from(sessions)
    .where(gte(sessions.lastActivity, activeThreshold))

  const [documentsAccessed] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${documentAccesses.documentId})` })
    .from(documentAccesses)
    .where(gte(documentAccesses.accessedAt, monthStart))

  const [blockedQueries] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(and(gte(auditLogs.createdAt, monthStart), eq(auditLogs.result, 'blocked')))

  const [deniedAccess] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(and(gte(auditLogs.createdAt, monthStart), eq(auditLogs.result, 'denied')))

  const [totalQueriesMonth] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.createdAt, monthStart),
        sql`${auditLogs.action} IN ('chat_query', 'file_upload')`
      )
    )

  const [avgResponse] = await db
    .select({ avg: avg(messages.processingMs) })
    .from(messages)
    .where(and(gte(messages.createdAt, monthStart), sql`${messages.processingMs} IS NOT NULL`))

  const avgMs = avgResponse?.avg ? Number(avgResponse.avg) : 0

  return {
    queriesToday: queriesToday?.count ?? 0,
    activeUsers: Number(activeUsers?.count ?? 0),
    documentsAccessed: Number(documentsAccessed?.count ?? 0),
    blockedQueries: blockedQueries?.count ?? 0,
    deniedAccess: deniedAccess?.count ?? 0,
    totalQueriesMonth: totalQueriesMonth?.count ?? 0,
    avgResponseTime: Math.round((avgMs / 1000) * 10) / 10,
  }
}

export async function getDashboardChartData(period: '7d' | '30d' | '90d') {
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
  const since = daysAgo(days - 1)

  const rows = await db
    .select({
      date: sql<string>`DATE(${auditLogs.createdAt})`.as('date'),
      queries: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.action} IN ('chat_query', 'file_upload'))`.as('queries'),
      users: sql<number>`COUNT(DISTINCT ${auditLogs.userId})`.as('users'),
      blocked: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.result} = 'blocked')`.as('blocked'),
    })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, since))
    .groupBy(sql`DATE(${auditLogs.createdAt})`)
    .orderBy(sql`DATE(${auditLogs.createdAt})`)

  const timeline = rows.map((row) => ({
    date: typeof row.date === 'string' ? row.date : String(row.date),
    queries: Number(row.queries),
    users: Number(row.users),
    blocked: Number(row.blocked),
  }))

  return { timeline }
}

export async function getTopUsers(limit = 5) {
  const monthStart = startOfMonth(new Date())

  const rows = await db
    .select({
      userName: auditLogs.userName,
      email: auditLogs.userEmail,
      queries: count(),
    })
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.createdAt, monthStart),
        sql`${auditLogs.action} IN ('chat_query', 'file_upload')`
      )
    )
    .groupBy(auditLogs.userName, auditLogs.userEmail)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)

  return rows.map((r) => ({
    userName: r.userName || 'Desconhecido',
    email: r.email || '',
    queries: r.queries,
  }))
}

export async function getTopDocuments(limit = 5) {
  const monthStart = startOfMonth(new Date())

  const rows = await db
    .select({
      documentName: documentAccesses.name,
      docType: documentAccesses.docType,
      accesses: count(),
    })
    .from(documentAccesses)
    .where(gte(documentAccesses.accessedAt, monthStart))
    .groupBy(documentAccesses.name, documentAccesses.docType)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)

  return rows.map((r) => ({
    documentName: r.documentName || 'Documento',
    type: r.docType || 'other',
    accesses: r.accesses,
  }))
}

export async function getSecurityEvents(days = 7) {
  const since = daysAgo(days)

  const rows = await db
    .select({
      date: sql<string>`DATE(${auditLogs.createdAt})`.as('date'),
      denied: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.result} = 'denied')`.as('denied'),
      blocked: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.result} = 'blocked')`.as('blocked'),
      errors: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.result} = 'error')`.as('errors'),
    })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, since))
    .groupBy(sql`DATE(${auditLogs.createdAt})`)
    .orderBy(sql`DATE(${auditLogs.createdAt})`)

  return rows.map((r) => ({
    date: typeof r.date === 'string' ? r.date : String(r.date),
    denied: Number(r.denied),
    blocked: Number(r.blocked),
    errors: Number(r.errors),
  }))
}
