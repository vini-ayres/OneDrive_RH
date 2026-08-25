import { Hono } from 'hono'
import { authMiddleware, getAuthUser } from '../middleware/auth.js'
import {
  getConversationList,
  getConversationMessages,
  updateConversation,
  deleteConversation,
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

export default history
