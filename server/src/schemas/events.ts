import { z } from 'zod'

export {
  chatCompletedEventSchema,
  chatCompletedEventLooseSchema,
  normalizeChatCompletedEvent,
  stripN8nValue,
} from './normalizeChatEvent.js'

export type { ChatCompletedEvent, ChatCompletedEventLoose } from './normalizeChatEvent.js'

export const documentAccessEventSchema = z.object({
  documentId: z.string().min(1),
  name: z.string().optional(),
  path: z.string().optional(),
  webUrl: z.string().optional(),
  docType: z.string().optional(),
  source: z.enum(['chat_source', 'search', 'upload', 'direct']).default('direct'),
})

export type DocumentAccessEvent = z.infer<typeof documentAccessEventSchema>
