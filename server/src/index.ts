import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.js'
import { internalApiKeyMiddleware } from './middleware/auth.js'
import history from './routes/history.js'
import audit from './routes/audit.js'
import dashboard from './routes/dashboard.js'
import documents from './routes/documents.js'
import internalEvents from './routes/internal/events.js'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: env.corsOrigin,
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token', 'X-Requested-With'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
)

app.route('/api', history)
app.route('/api', audit)
app.route('/api', dashboard)
app.route('/api', documents)

const internal = new Hono()
internal.use('*', internalApiKeyMiddleware)
internal.route('/events', internalEvents)
app.route('/internal', internal)

console.log(`Data API listening on http://0.0.0.0:${env.port}`)

serve({
  fetch: app.fetch,
  port: env.port,
})

export default app
