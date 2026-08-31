import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import type { AuthUser } from '../middleware/rbac.js'

export async function ensureUserFromAuth(user: AuthUser): Promise<{ tokenVersion: number }> {
  const now = new Date()

  await db
    .insert(users)
    .values({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email || null,
      department: user.department || null,
      roles: user.roles,
      groups: user.groups,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username: user.username,
        displayName: user.displayName,
        email: user.email || null,
        department: user.department || null,
        roles: user.roles,
        groups: user.groups,
        lastSeenAt: now,
      },
    })

  const row = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  return { tokenVersion: row[0]?.tokenVersion ?? 0 }
}

export async function getUserTokenVersion(userId: string): Promise<number | null> {
  const row = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return row[0]?.tokenVersion ?? null
}

export async function bumpUserTokenVersion(userId: string): Promise<number> {
  const current = await getUserTokenVersion(userId)
  const next = (current ?? 0) + 1

  await db.update(users).set({ tokenVersion: next }).where(eq(users.id, userId))
  return next
}
