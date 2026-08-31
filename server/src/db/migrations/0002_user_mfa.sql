ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "user_mfa" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "totp_secret_encrypted" text NOT NULL,
  "pending_totp_secret_encrypted" text,
  "confirmed" boolean NOT NULL DEFAULT false,
  "backup_code_hashes" text[] NOT NULL DEFAULT '{}',
  "failed_attempts" integer NOT NULL DEFAULT 0,
  "locked_until" timestamp with time zone,
  "enrolled_at" timestamp with time zone,
  "last_verified_at" timestamp with time zone
);
