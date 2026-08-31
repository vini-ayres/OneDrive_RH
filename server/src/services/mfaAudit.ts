import { db } from '../db/client.js'
import { auditLogs } from '../db/schema.js'
import { getHighestRole, type AuthUser } from '../middleware/rbac.js'

export type MfaAuditAction =
  | 'auth.mfa.enroll'
  | 'auth.mfa.verify'
  | 'auth.mfa.backup'
  | 'auth.mfa.lockout'
  | 'auth.mfa.reset'
  | 'auth.mfa.replace'
  | 'auth.mfa.backup_regenerate'

export async function recordMfaAudit(input: {
  user: Pick<AuthUser, 'id' | 'username' | 'displayName' | 'email' | 'roles'>
  action: MfaAuditAction
  result: 'success' | 'error' | 'denied'
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, string>
}) {
  await db.insert(auditLogs).values({
    userId: input.user.id,
    userName: input.user.displayName || input.user.username,
    userEmail: input.user.email || null,
    role: getHighestRole(input.user.roles),
    action: input.action,
    result: input.result,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
    requestId: crypto.randomUUID(),
    metadata: input.metadata ?? null,
  })
}
