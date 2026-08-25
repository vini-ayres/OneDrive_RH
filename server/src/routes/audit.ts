import { Hono } from 'hono'
import { authMiddleware, getAuthUser } from '../middleware/auth.js'
import { hasPermission } from '../middleware/rbac.js'
import { queryAuditLogs } from '../services/auditQueries.js'
import { apiSuccess, apiError } from '../utils/response.js'

const audit = new Hono()
audit.use('*', authMiddleware)

audit.get('/audit', async (c) => {
  const user = getAuthUser(c)

  if (!hasPermission(user, 'canViewAuditLog')) {
    const err = apiError('FORBIDDEN', 403)
    return c.json(err.body, err.status)
  }

  const page = Number(c.req.query('page') || 1)
  const pageSize = Number(c.req.query('pageSize') || 15)
  const offset = (page - 1) * pageSize

  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')

  const result = await queryAuditLogs({
    userId: c.req.query('userId') || undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    result: c.req.query('result') || undefined,
    documentName: c.req.query('documentName') || undefined,
    limit: pageSize,
    offset,
  })

  return c.json(
    apiSuccess({
      logs: result.logs.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      })),
      total: result.total,
      counts: result.counts,
      page,
      pageSize,
    })
  )
})

export default audit
