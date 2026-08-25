import { ne, type SQL } from 'drizzle-orm'
import { auditLogs, documentAccesses, sessions, conversations } from '../db/schema.js'

/** Usuário sintético do modo de teste local — não deve aparecer em auditoria nem no dashboard. */
export const EXCLUDED_TEST_USER_ID = 'local-test-user'

export function excludeTestUserFromAudit(): SQL {
  return ne(auditLogs.userId, EXCLUDED_TEST_USER_ID)
}

export function excludeTestUserFromDocumentAccesses(): SQL {
  return ne(documentAccesses.userId, EXCLUDED_TEST_USER_ID)
}

export function excludeTestUserFromSessions(): SQL {
  return ne(sessions.userId, EXCLUDED_TEST_USER_ID)
}

export function excludeTestUserFromConversations(): SQL {
  return ne(conversations.userId, EXCLUDED_TEST_USER_ID)
}
