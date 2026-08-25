import { Hono } from 'hono'
import { authMiddleware, getAuthUser } from '../middleware/auth.js'
import { hasPermission } from '../middleware/rbac.js'
import {
  getDashboardStats,
  getDashboardChartData,
  getTopUsers,
  getTopDocuments,
  getAiSlaEvents,
} from '../services/dashboardQueries.js'
import { apiSuccess, apiError } from '../utils/response.js'

const dashboard = new Hono()
dashboard.use('*', authMiddleware)

dashboard.get('/dashboard/stats', async (c) => {
  const user = getAuthUser(c)

  if (!hasPermission(user, 'canViewDashboard')) {
    const err = apiError('FORBIDDEN', 403)
    return c.json(err.body, err.status)
  }

  const stats = await getDashboardStats()
  return c.json(apiSuccess(stats))
})

dashboard.get('/dashboard/charts', async (c) => {
  const user = getAuthUser(c)

  if (!hasPermission(user, 'canViewDashboard')) {
    const err = apiError('FORBIDDEN', 403)
    return c.json(err.body, err.status)
  }

  const periodParam = c.req.query('period') || '7d'
  const period = periodParam === '30d' || periodParam === '90d' ? periodParam : '7d'

  const [chartData, topUsers, topDocuments, aiSlaEvents] = await Promise.all([
    getDashboardChartData(period),
    getTopUsers(),
    getTopDocuments(),
    getAiSlaEvents(period === '90d' ? 90 : period === '30d' ? 30 : 7),
  ])

  return c.json(
    apiSuccess({
      ...chartData,
      topUsers,
      topDocuments,
      aiSlaEvents,
    })
  )
})

export default dashboard
