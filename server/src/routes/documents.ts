import { Hono } from 'hono'
import { authMiddleware, getAuthUser } from '../middleware/auth.js'
import { documentAccessEventSchema } from '../schemas/events.js'
import { getRecentDocuments } from '../services/documentQueries.js'
import { recordDocumentAccess } from '../services/chatPersistence.js'
import { apiSuccess, apiError } from '../utils/response.js'

const documents = new Hono()
documents.use('*', authMiddleware)

documents.get('/documents/recent', async (c) => {
  const user = getAuthUser(c)
  const limit = Number(c.req.query('limit') || 50)

  const docs = await getRecentDocuments(user.id, limit)
  return c.json(
    apiSuccess({
      documents: docs.map((d) => ({
        ...d,
        modifiedAt: d.modifiedAt.toISOString(),
      })),
    })
  )
})

documents.post('/documents/:id/access', async (c) => {
  const user = getAuthUser(c)
  const documentId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const parsed = documentAccessEventSchema.safeParse({
    ...body,
    documentId,
  })

  if (!parsed.success) {
    const err = apiError(parsed.error.errors.map((e) => e.message).join('; '), 400)
    return c.json(err.body, err.status)
  }

  await recordDocumentAccess(user.id, parsed.data)

  return c.json(apiSuccess({ recorded: true }))
})

export default documents
