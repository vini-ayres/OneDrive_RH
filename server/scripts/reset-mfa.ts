/**
 * Break-glass: apaga o MFA de um usuário e invalida sessões abertas.
 * Uso (na pasta server): npx tsx scripts/reset-mfa.ts <username>
 */
import { eq } from 'drizzle-orm'
import { db, pool } from '../src/db/client.js'
import { auditLogs, users } from '../src/db/schema.js'
import { resetUserMfaBreakGlass } from '../src/services/mfa.js'

const username = process.argv[2]?.trim()

if (!username) {
  console.error('Uso: npx tsx scripts/reset-mfa.ts <username>')
  process.exit(1)
}

async function main() {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      roles: users.roles,
    })
    .from(users)
    .where(eq(users.id, username))
    .limit(1)

  const user = rows[0]
  if (!user) {
    console.error(`Usuário não encontrado: ${username}`)
    process.exit(1)
  }

  await resetUserMfaBreakGlass(user.id)
  await db.insert(auditLogs).values({
    userId: user.id,
    userName: user.displayName || user.username,
    userEmail: user.email || null,
    role: user.roles[0] || 'colaborador',
    action: 'auth.mfa.reset',
    result: 'success',
    requestId: crypto.randomUUID(),
    metadata: { actor: 'system:cli', targetUserId: user.id },
  })

  console.log(`MFA resetado para ${user.username}. O próximo login exigirá novo cadastro.`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await pool.end()
  })
