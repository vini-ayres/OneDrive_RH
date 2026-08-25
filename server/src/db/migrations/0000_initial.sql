-- Initial schema for OneDrive RH data API
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "display_name" text,
  "email" text,
  "department" text,
  "roles" text[] DEFAULT '{}' NOT NULL,
  "groups" text[] DEFAULT '{}',
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "ip_address" text,
  "user_agent" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_activity" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_activity" ON "sessions" ("user_id", "last_activity");

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "title" text DEFAULT 'Nova conversa' NOT NULL,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_conversations_user_updated" ON "conversations" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" text NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "status" text DEFAULT 'sent' NOT NULL,
  "request_id" text,
  "processing_ms" integer,
  "blocked_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_messages_conversation" ON "messages" ("conversation_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_messages_request_id" ON "messages" ("request_id") WHERE "request_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "message_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "document_id" text,
  "name" text,
  "path" text,
  "web_url" text,
  "doc_type" text,
  "relevance_score" real,
  "excerpt" text
);

CREATE TABLE IF NOT EXISTS "message_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "name" text,
  "size_bytes" integer,
  "mime_type" text,
  "folder_path" text
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "user_name" text,
  "user_email" text,
  "role" text,
  "action" text NOT NULL,
  "query" text,
  "document_accessed" text,
  "document_path" text,
  "result" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "session_id" text,
  "request_id" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "audit_logs" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_result" ON "audit_logs" ("result", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_audit_request_id" ON "audit_logs" ("request_id") WHERE "request_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "document_accesses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "document_id" text NOT NULL,
  "name" text,
  "path" text,
  "web_url" text,
  "doc_type" text,
  "source" text NOT NULL,
  "message_id" uuid REFERENCES "messages"("id"),
  "accessed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_doc_access_user_doc" ON "document_accesses" ("user_id", "document_id");
CREATE INDEX IF NOT EXISTS "idx_doc_access_user_time" ON "document_accesses" ("user_id", "accessed_at");

-- Append-only policy: revoke UPDATE/DELETE on audit_logs from application role (run as superuser in production)
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
