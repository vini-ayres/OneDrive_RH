import { Hono } from 'hono'
import { authMiddleware, getAuthUser } from '../middleware/auth.js'
import {
  getConversationList,
  getConversationMessages,
  updateConversation,
  deleteConversation,
  recordAiQueryOutcome,
} from '../services/chatPersistence.js'
import { apiSuccess, apiError } from '../utils/response.js'

const history = new Hono()
history.use('*', authMiddleware)

history.get('/history', async (c) => {
  const user = getAuthUser(c)
  const userId = c.req.query('userId') || user.id

  if (userId !== user.id) {
    const err = apiError('FORBIDDEN', 403)
    return c.json(err.body, err.status)
  }

  const conversations = await getConversationList(userId)
  return c.json(
    apiSuccess({
      conversations: conversations.map((conv) => ({
        id: conv.id,
        title: conv.title,
        isFavorite: conv.isFavorite,
        updatedAt: conv.updatedAt.toISOString(),
        createdAt: conv.createdAt.toISOString(),
      })),
    })
  )
})

history.get('/conversations/:id/messages', async (c) => {
  const user = getAuthUser(c)
  const conversationId = c.req.param('id')

  const data = await getConversationMessages(conversationId, user.id)
  if (!data) {
    const err = apiError('NOT_FOUND', 404)
    return c.json(err.body, err.status)
  }

  return c.json(
    apiSuccess({
      conversation: {
        id: data.conversation.id,
        title: data.conversation.title,
        isFavorite: data.conversation.isFavorite,
        userId: data.conversation.userId,
        createdAt: data.conversation.createdAt.toISOString(),
        updatedAt: data.conversation.updatedAt.toISOString(),
      },
      messages: data.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
    })
  )
})

history.patch('/conversations/:id', async (c) => {
  const user = getAuthUser(c)
  const conversationId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const updated = await updateConversation(conversationId, user.id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    isFavorite: typeof body.isFavorite === 'boolean' ? body.isFavorite : undefined,
  })

  if (!updated) {
    const err = apiError('NOT_FOUND', 404)
    return c.json(err.body, err.status)
  }

  return c.json(
    apiSuccess({
      id: updated.id,
      title: updated.title,
      isFavorite: updated.isFavorite,
      updatedAt: updated.updatedAt.toISOString(),
    })
  )
})

history.delete('/conversations/:id', async (c) => {
  const user = getAuthUser(c)
  const conversationId = c.req.param('id')

  const deleted = await deleteConversation(conversationId, user.id)
  if (!deleted) {
    const err = apiError('NOT_FOUND', 404)
    return c.json(err.body, err.status)
  }

  return c.json(apiSuccess({ deleted: true }))
})

history.post('/ai-query-outcome', async (c) => {
  const user = getAuthUser(c)
  const body = await c.req.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    const err = apiError('Payload inválido', 400)
    return c.json(err.body, err.status)
  }

  const payload = body as Record<string, unknown>
  const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : ''
  const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId.trim() : ''
  const query = typeof payload.query === 'string' ? payload.query : ''
  const result = payload.result === 'error' ? 'error' : payload.result === 'success' ? 'success' : null
  const action = payload.action === 'file_upload' ? 'file_upload' : 'chat_query'

  if (!requestId || !conversationId || !query || !result) {
    const err = apiError('requestId, conversationId, query e result são obrigatórios', 400)
    return c.json(err.body, err.status)
  }

  try {
    const persisted = await recordAiQueryOutcome({
      user: {
        id: user.id,
        userName: user.displayName || user.username,
        userEmail: user.email,
        roles: user.roles,
        groups: user.groups,
      },
      requestId,
      conversationId,
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : undefined,
      action,
      result,
      query,
      processingMs: typeof payload.processingMs === 'number' ? payload.processingMs : undefined,
      errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : undefined,
      ipAddress: typeof payload.ipAddress === 'string' ? payload.ipAddress : undefined,
      userAgent: typeof payload.userAgent === 'string' ? payload.userAgent : undefined,
      documentAccessed: typeof payload.documentAccessed === 'string' ? payload.documentAccessed : undefined,
      documentPath: typeof payload.documentPath === 'string' ? payload.documentPath : undefined,
    })

    return c.json(apiSuccess({ recorded: true, duplicate: persisted.duplicate }, { requestId }))
  } catch (error) {
    console.error('Failed to record AI query outcome:', error)
    const err = apiError('PERSISTENCE_ERROR', 500)
    return c.json(err.body, err.status)
  }
})

export default history
