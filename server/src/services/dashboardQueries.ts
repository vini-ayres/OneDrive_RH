import { eq, and, gte, sql, count, avg } from 'drizzle-orm'
import { db } from '../db/client.js'
import { auditLogs, sessions, documentAccesses, messages, conversations } from '../db/schema.js'
import {
  excludeTestUserFromAudit,
  excludeTestUserFromDocumentAccesses,
  excludeTestUserFromSessions,
  excludeTestUserFromConversations,
} from './excludedUsers.js'

/** Fuso do negócio. O servidor e o PostgreSQL estão em UTC. */
export const DASHBOARD_TIMEZONE = 'America/Sao_Paulo'

type Period = '7d' | '30d' | '90d'

function periodDays(period: Period): number {
  return period === '30d' ? 30 : period === '90d' ? 90 : 7
}

function tzParts(date: Date, timeZone = DASHBOARD_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: num('year'),
    month: num('month'),
    day: num('day'),
    hour: num('hour'),
    minute: num('minute'),
    second: num('second'),
  }
}

function timeZoneOffsetMs(date: Date, timeZone = DASHBOARD_TIMEZONE): number {
  const local = tzParts(date, timeZone)
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
  return asUtc - date.getTime()
}

function zonedMidnight(year: number, month: number, day: number, timeZone = DASHBOARD_TIMEZONE): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0)
  return new Date(utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone))
}

function startOfDayTz(date = new Date()): Date {
  const { year, month, day } = tzParts(date)
  return zonedMidnight(year, month, day)
}

function daysAgoTz(days: number, from = new Date()): Date {
  const { year, month, day } = tzParts(from)
  const shifted = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  shifted.setUTCDate(shifted.getUTCDate() - days)
  return startOfDayTz(shifted)
}

function ymdFromDate(date: Date): string {
  const { year, month, day } = tzParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function enumerateYmdRange(from: Date, to = new Date()): string[] {
  const dates: string[] = []
  let cursor = startOfDayTz(from)
  const end = startOfDayTz(to).getTime()

  while (cursor.getTime() <= end) {
    dates.push(ymdFromDate(cursor))
    cursor = startOfDayTz(new Date(cursor.getTime() + 36 * 60 * 60 * 1000))
  }

  return dates
}

function sqlCalendarDate(column: typeof auditLogs.createdAt | typeof documentAccesses.accessedAt) {
  return sql<string>`to_char(${column} AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`
}

function toYmd(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return ymdFromDate(value)
  }
  const asDate = new Date(String(value))
  if (!Number.isNaN(asDate.getTime())) {
    return ymdFromDate(asDate)
  }
  return String(value)
}

function fillDailySeries<T extends { date: string }>(
  since: Date,
  rows: T[],
  empty: (date: string) => T
): T[] {
  const byDate = new Map(rows.map((row) => [row.date, row]))
  return enumerateYmdRange(since).map((date) => byDate.get(date) ?? empty(date))
}

const QUERY_ACTIONS = sql`${auditLogs.action} IN ('chat_query', 'file_upload')`

export async function getDashboardStats() {
  const today = startOfDayTz()
  const last30Days = daysAgoTz(29)
  const activeThreshold = new Date(Date.now() - 30 * 60 * 1000)

  const [queriesToday] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(and(excludeTestUserFromAudit(), gte(auditLogs.createdAt, today), QUERY_ACTIONS))

  const [activeUsers] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${sessions.userId})` })
    .from(sessions)
    .where(and(excludeTestUserFromSessions(), gte(sessions.lastActivity, activeThreshold)))

  const [documentsAccessed] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${documentAccesses.documentId})` })
    .from(documentAccesses)
    .where(and(excludeTestUserFromDocumentAccesses(), gte(documentAccesses.accessedAt, last30Days)))

  const [failedQueries] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(
      and(
        excludeTestUserFromAudit(),
        gte(auditLogs.createdAt, last30Days),
        eq(auditLogs.result, 'error'),
        QUERY_ACTIONS
      )
    )

  const [totalQueriesMonth] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(and(excludeTestUserFromAudit(), gte(auditLogs.createdAt, last30Days), QUERY_ACTIONS))

  const [avgAudit] = await db
    .select({
      avg: sql<number>`AVG((${auditLogs.metadata}->>'processingMs')::numeric)`,
    })
    .from(auditLogs)
    .where(
      and(
        excludeTestUserFromAudit(),
        gte(auditLogs.createdAt, last30Days),
        QUERY_ACTIONS,
        sql`(${auditLogs.metadata} ->> 'processingMs') IS NOT NULL`
      )
    )

  const [avgResponse] = await db
    .select({ avg: avg(messages.processingMs) })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        excludeTestUserFromConversations(),
        gte(messages.createdAt, last30Days),
        sql`${messages.processingMs} IS NOT NULL`,
        eq(messages.role, 'assistant')
      )
    )

  const avgMs = Number(avgAudit?.avg || avgResponse?.avg || 0)
  const totalAiQueries = totalQueriesMonth?.count ?? 0
  const failures = failedQueries?.count ?? 0
  const slaPercent =
    totalAiQueries === 0 ? 100 : Math.round(((totalAiQueries - failures) / totalAiQueries) * 1000) / 10

  return {
    queriesToday: queriesToday?.count ?? 0,
    activeUsers: Number(activeUsers?.count ?? 0),
    documentsAccessed: Number(documentsAccessed?.count ?? 0),
    failedQueries: failures,
    slaPercent,
    totalQueriesMonth: totalAiQueries,
    avgResponseTime: Math.round((avgMs / 1000) * 10) / 10,
  }
}

export async function getDashboardChartData(period: Period) {
  const days = periodDays(period)
  const since = daysAgoTz(days - 1)

  const rows = await db
    .select({
      date: sqlCalendarDate(auditLogs.createdAt).as('date'),
      queries: sql<number>`COUNT(*)`.as('queries'),
      users: sql<number>`COUNT(DISTINCT ${auditLogs.userId})`.as('users'),
      failures: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.result} = 'error')`.as('failures'),
    })
    .from(auditLogs)
    .where(and(excludeTestUserFromAudit(), gte(auditLogs.createdAt, since), QUERY_ACTIONS))
    .groupBy(sqlCalendarDate(auditLogs.createdAt))
    .orderBy(sqlCalendarDate(auditLogs.createdAt))

  const timeline = fillDailySeries(
    since,
    rows.map((row) => ({
      date: toYmd(row.date),
      queries: Number(row.queries),
      users: Number(row.users),
      failures: Number(row.failures),
    })),
    (date) => ({ date, queries: 0, users: 0, failures: 0 })
  )

  return { timeline }
}

export async function getTopUsers(period: Period = '7d', limit = 5) {
  const since = daysAgoTz(periodDays(period) - 1)

  const rows = await db
    .select({
      userName: auditLogs.userName,
      email: auditLogs.userEmail,
      queries: count(),
    })
    .from(auditLogs)
    .where(and(excludeTestUserFromAudit(), gte(auditLogs.createdAt, since), QUERY_ACTIONS))
    .groupBy(auditLogs.userName, auditLogs.userEmail)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)

  return rows.map((r) => ({
    userName: r.userName || 'Desconhecido',
    email: r.email || '',
    queries: r.queries,
  }))
}

export async function getTopDocuments(period: Period = '7d', limit = 5) {
  const since = daysAgoTz(periodDays(period) - 1)

  const rows = await db
    .select({
      documentName: documentAccesses.name,
      docType: documentAccesses.docType,
      accesses: count(),
    })
    .from(documentAccesses)
    .where(and(excludeTestUserFromDocumentAccesses(), gte(documentAccesses.accessedAt, since)))
    .groupBy(documentAccesses.name, documentAccesses.docType)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit)

  return rows.map((r) => ({
    documentName: r.documentName || 'Documento',
    type: r.docType || 'other',
    accesses: r.accesses,
  }))
}

export async function getAiSlaEvents(period: Period = '7d') {
  const since = daysAgoTz(periodDays(period) - 1)

  const rows = await db
    .select({
      date: sqlCalendarDate(auditLogs.createdAt).as('date'),
      successes: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.result} = 'success')`.as('successes'),
      failures: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.result} = 'error')`.as('failures'),
    })
    .from(auditLogs)
    .where(and(excludeTestUserFromAudit(), gte(auditLogs.createdAt, since), QUERY_ACTIONS))
    .groupBy(sqlCalendarDate(auditLogs.createdAt))
    .orderBy(sqlCalendarDate(auditLogs.createdAt))

  return fillDailySeries(
    since,
    rows.map((r) => ({
      date: toYmd(r.date),
      successes: Number(r.successes),
      failures: Number(r.failures),
    })),
    (date) => ({ date, successes: 0, failures: 0 })
  )
}
