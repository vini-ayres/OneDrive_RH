import { Hono } from 'hono'
import { chatCompletedEventLooseSchema } from '../../schemas/events.js'
import { normalizeChatCompletedEvent } from '../../schemas/normalizeChatEvent.js'
import { persistChatCompletedEvent } from '../../services/chatPersistence.js'
import { apiSuccess, apiError } from '../../utils/response.js'

const events = new Hono()

events.post('/chat-completed', async (c) => {
  const body = await c.req.json().catch(() => null)
  const loose = chatCompletedEventLooseSchema.safeParse(body)

  if (!loose.success) {
    const err = apiError(loose.error.errors.map((e) => e.message).join('; '), 400)
    return c.json(err.body, err.status)
  }

  let event
  try {
    event = normalizeChatCompletedEvent(loose.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payload inválido'
    const err = apiError(message, 400)
    return c.json(err.body, err.status)
  }

  try {
    const result = await persistChatCompletedEvent(event)
    return c.json(
      apiSuccess(
        { persisted: !result.duplicate, duplicate: result.duplicate },
        { requestId: event.requestId }
      ),
      result.duplicate ? 200 : 201
    )
  } catch (error) {
    console.error('Failed to persist chat event:', error)
    const err = apiError('PERSISTENCE_ERROR', 500)
    return c.json(err.body, err.status)
  }
})

export default events
