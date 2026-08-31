import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  index,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  displayName: text('display_name'),
  email: text('email'),
  department: text('department'),
  roles: text('roles').array().notNull().default([]),
  groups: text('groups').array().default([]),
  tokenVersion: integer('token_version').notNull().default(0),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userMfa = pgTable('user_mfa', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  totpSecretEncrypted: text('totp_secret_encrypted').notNull(),
  pendingTotpSecretEncrypted: text('pending_totp_secret_encrypted'),
  confirmed: boolean('confirmed').notNull().default(false),
  backupCodeHashes: text('backup_code_hashes').array().notNull().default([]),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
})

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastActivity: timestamp('last_activity', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_sessions_user_activity').on(table.userId, table.lastActivity),
  ]
)

export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull().default('Nova conversa'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_conversations_user_updated').on(table.userId, table.updatedAt),
  ]
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    status: text('status').notNull().default('sent'),
    requestId: text('request_id'),
    processingMs: integer('processing_ms'),
    blockedReason: text('blocked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_messages_conversation').on(table.conversationId, table.createdAt),
    uniqueIndex('idx_messages_request_id').on(table.requestId),
  ]
)

export const messageSources = pgTable('message_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  documentId: text('document_id'),
  name: text('name'),
  path: text('path'),
  webUrl: text('web_url'),
  docType: text('doc_type'),
  relevanceScore: real('relevance_score'),
  excerpt: text('excerpt'),
})

export const messageAttachments = pgTable('message_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  name: text('name'),
  sizeBytes: integer('size_bytes'),
  mimeType: text('mime_type'),
  folderPath: text('folder_path'),
})

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    userName: text('user_name'),
    userEmail: text('user_email'),
    role: text('role'),
    action: text('action').notNull(),
    query: text('query'),
    documentAccessed: text('document_accessed'),
    documentPath: text('document_path'),
    result: text('result').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    sessionId: text('session_id'),
    requestId: text('request_id'),
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_created').on(table.createdAt),
    index('idx_audit_user').on(table.userId, table.createdAt),
    index('idx_audit_result').on(table.result, table.createdAt),
    uniqueIndex('idx_audit_request_id').on(table.requestId),
  ]
)

export const documentAccesses = pgTable(
  'document_accesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    documentId: text('document_id').notNull(),
    name: text('name'),
    path: text('path'),
    webUrl: text('web_url'),
    docType: text('doc_type'),
    source: text('source').notNull(),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_doc_access_user_doc').on(table.userId, table.documentId),
    index('idx_doc_access_user_time').on(table.userId, table.accessedAt),
  ]
)

export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  auditLogs: many(auditLogs),
  documentAccesses: many(documentAccesses),
  mfa: one(userMfa, { fields: [users.id], references: [userMfa.userId] }),
}))

export const userMfaRelations = relations(userMfa, ({ one }) => ({
  user: one(users, { fields: [userMfa.userId], references: [users.id] }),
}))

export const conversationsRelations = relations(conversations, ({ many, one }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ many, one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sources: many(messageSources),
  attachments: many(messageAttachments),
}))

export type User = typeof users.$inferSelect
export type UserMfa = typeof userMfa.$inferSelect
export type Conversation = typeof conversations.$inferSelect
export type Message = typeof messages.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type DocumentAccess = typeof documentAccesses.$inferSelect
