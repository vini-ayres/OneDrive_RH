import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { userMfa, users } from '../db/schema.js'
import { bumpUserTokenVersion } from './userStore.js'
import { buildOtpauthUrl, generateTotpSecret, verifyTotpCode } from './totp.js'
import {
  decryptSecret,
  encryptSecret,
  findMatchingBackupHash,
  generateBackupCodes,
  hashBackupCodes,
  looksLikeTotp,
} from './mfaCrypto.js'
import { MFA_LOCKOUT_MINUTES, MFA_MAX_FAILURES } from './rateLimit.js'

export class MfaError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'MFA_LOCKED'
      | 'INVALID_MFA_CODE'
      | 'MFA_NOT_PENDING'
      | 'MFA_ALREADY_ENABLED'
      | 'MFA_NOT_ENABLED'
      | 'MFA_REPLACE_NOT_PENDING'
      | 'CANNOT_RESET_SELF',
    readonly status: 400 | 401 | 409 | 423 = 401
  ) {
    super(message)
    this.name = 'MfaError'
  }
}

type MfaRow = typeof userMfa.$inferSelect

export async function getMfaRecord(userId: string): Promise<MfaRow | null> {
  const rows = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1)
  return rows[0] ?? null
}

export function isMfaConfirmed(record: MfaRow | null): boolean {
  return Boolean(record?.confirmed)
}

function assertUnlocked(record: MfaRow | null) {
  if (record?.lockedUntil && record.lockedUntil > new Date()) {
    throw new MfaError(
      'Muitas tentativas inválidas. Tente novamente em alguns minutos.',
      'MFA_LOCKED',
      423
    )
  }
}

async function registerFailure(userId: string, record: MfaRow | null): Promise<boolean> {
  const attempts = (record?.failedAttempts ?? 0) + 1
  const locked = attempts >= MFA_MAX_FAILURES
  const lockedUntil = locked ? new Date(Date.now() + MFA_LOCKOUT_MINUTES * 60 * 1000) : null

  if (record) {
    await db
      .update(userMfa)
      .set({
        failedAttempts: locked ? 0 : attempts,
        lockedUntil,
      })
      .where(eq(userMfa.userId, userId))
  }

  return locked
}

async function clearFailures(userId: string) {
  await db
    .update(userMfa)
    .set({ failedAttempts: 0, lockedUntil: null, lastVerifiedAt: new Date() })
    .where(eq(userMfa.userId, userId))
}

export async function startEnrollment(userId: string, username: string) {
  const existing = await getMfaRecord(userId)
  if (isMfaConfirmed(existing)) {
    throw new MfaError('MFA já está ativo nesta conta.', 'MFA_ALREADY_ENABLED', 409)
  }
  assertUnlocked(existing)

  const secret = generateTotpSecret()
  const encrypted = encryptSecret(secret)

  if (existing) {
    await db
      .update(userMfa)
      .set({
        totpSecretEncrypted: encrypted,
        pendingTotpSecretEncrypted: null,
        confirmed: false,
        backupCodeHashes: [],
      })
      .where(eq(userMfa.userId, userId))
  } else {
    await db.insert(userMfa).values({
      userId,
      totpSecretEncrypted: encrypted,
      confirmed: false,
      backupCodeHashes: [],
    })
  }

  return {
    otpauthUrl: buildOtpauthUrl(username, secret),
    secret,
  }
}

export async function confirmEnrollment(userId: string, code: string): Promise<string[]> {
  const record = await getMfaRecord(userId)
  if (!record || record.confirmed) {
    throw new MfaError('Cadastro de MFA não iniciado.', 'MFA_NOT_PENDING', 400)
  }
  assertUnlocked(record)

  const secret = decryptSecret(record.totpSecretEncrypted)
  if (!verifyTotpCode(secret, code)) {
    const locked = await registerFailure(userId, record)
    throw new MfaError(
      locked
        ? 'Muitas tentativas inválidas. Tente novamente em alguns minutos.'
        : 'Código inválido. Confira o app autenticador.',
      locked ? 'MFA_LOCKED' : 'INVALID_MFA_CODE',
      locked ? 423 : 401
    )
  }

  const backupCodes = generateBackupCodes()
  await db
    .update(userMfa)
    .set({
      confirmed: true,
      backupCodeHashes: hashBackupCodes(backupCodes),
      failedAttempts: 0,
      lockedUntil: null,
      enrolledAt: new Date(),
      lastVerifiedAt: new Date(),
      pendingTotpSecretEncrypted: null,
    })
    .where(eq(userMfa.userId, userId))

  return backupCodes
}

export async function verifyMfaCode(
  userId: string,
  code: string
): Promise<{ method: 'totp' | 'backup'; lockedOut: boolean }> {
  const record = await getMfaRecord(userId)
  if (!isMfaConfirmed(record) || !record) {
    throw new MfaError('MFA não está ativo nesta conta.', 'MFA_NOT_ENABLED', 400)
  }
  assertUnlocked(record)

  const totpOk = looksLikeTotp(code) && verifyTotpCode(decryptSecret(record.totpSecretEncrypted), code)
  if (totpOk) {
    await clearFailures(userId)
    return { method: 'totp', lockedOut: false }
  }

  const hashes = record.backupCodeHashes ?? []
  const matched = findMatchingBackupHash(code, hashes)
  if (matched) {
    await db
      .update(userMfa)
      .set({
        backupCodeHashes: hashes.filter((hash) => hash !== matched),
        failedAttempts: 0,
        lockedUntil: null,
        lastVerifiedAt: new Date(),
      })
      .where(eq(userMfa.userId, userId))
    return { method: 'backup', lockedOut: false }
  }

  const locked = await registerFailure(userId, record)
  throw new MfaError(
    locked
      ? 'Muitas tentativas inválidas. Tente novamente em alguns minutos.'
      : 'Código inválido. Use o app autenticador ou um código de recuperação.',
    locked ? 'MFA_LOCKED' : 'INVALID_MFA_CODE',
    locked ? 423 : 401
  )
}

export async function getMfaStatus(userId: string) {
  const record = await getMfaRecord(userId)
  return {
    enabled: isMfaConfirmed(record),
    backupCodesRemaining: record?.backupCodeHashes?.length ?? 0,
    enrolledAt: record?.enrolledAt?.toISOString() ?? null,
  }
}

export async function regenerateBackupCodes(userId: string, totpCode: string): Promise<string[]> {
  const record = await getMfaRecord(userId)
  if (!isMfaConfirmed(record) || !record) {
    throw new MfaError('MFA não está ativo nesta conta.', 'MFA_NOT_ENABLED', 400)
  }
  assertUnlocked(record)

  if (!verifyTotpCode(decryptSecret(record.totpSecretEncrypted), totpCode)) {
    const locked = await registerFailure(userId, record)
    throw new MfaError(
      locked
        ? 'Muitas tentativas inválidas. Tente novamente em alguns minutos.'
        : 'Código inválido. Confira o app autenticador.',
      locked ? 'MFA_LOCKED' : 'INVALID_MFA_CODE',
      locked ? 423 : 401
    )
  }

  const backupCodes = generateBackupCodes()
  await db
    .update(userMfa)
    .set({
      backupCodeHashes: hashBackupCodes(backupCodes),
      failedAttempts: 0,
      lockedUntil: null,
      lastVerifiedAt: new Date(),
    })
    .where(eq(userMfa.userId, userId))

  return backupCodes
}

export async function startReplaceAuthenticator(userId: string, username: string, totpCode: string) {
  const record = await getMfaRecord(userId)
  if (!isMfaConfirmed(record) || !record) {
    throw new MfaError('MFA não está ativo nesta conta.', 'MFA_NOT_ENABLED', 400)
  }
  assertUnlocked(record)

  if (!verifyTotpCode(decryptSecret(record.totpSecretEncrypted), totpCode)) {
    const locked = await registerFailure(userId, record)
    throw new MfaError(
      locked
        ? 'Muitas tentativas inválidas. Tente novamente em alguns minutos.'
        : 'Código inválido. Confira o app autenticador.',
      locked ? 'MFA_LOCKED' : 'INVALID_MFA_CODE',
      locked ? 423 : 401
    )
  }

  const secret = generateTotpSecret()
  await db
    .update(userMfa)
    .set({
      pendingTotpSecretEncrypted: encryptSecret(secret),
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(userMfa.userId, userId))

  return {
    otpauthUrl: buildOtpauthUrl(username, secret),
    secret,
  }
}

export async function confirmReplaceAuthenticator(userId: string, totpCode: string) {
  const record = await getMfaRecord(userId)
  if (!isMfaConfirmed(record) || !record?.pendingTotpSecretEncrypted) {
    throw new MfaError(
      'Troca de autenticador não iniciada.',
      'MFA_REPLACE_NOT_PENDING',
      400
    )
  }
  assertUnlocked(record)

  const pendingSecret = decryptSecret(record.pendingTotpSecretEncrypted)
  if (!verifyTotpCode(pendingSecret, totpCode)) {
    const locked = await registerFailure(userId, record)
    throw new MfaError(
      locked
        ? 'Muitas tentativas inválidas. Tente novamente em alguns minutos.'
        : 'Código inválido. Confira o novo app autenticador.',
      locked ? 'MFA_LOCKED' : 'INVALID_MFA_CODE',
      locked ? 423 : 401
    )
  }

  await db
    .update(userMfa)
    .set({
      totpSecretEncrypted: record.pendingTotpSecretEncrypted,
      pendingTotpSecretEncrypted: null,
      failedAttempts: 0,
      lockedUntil: null,
      lastVerifiedAt: new Date(),
    })
    .where(eq(userMfa.userId, userId))
}

export async function listUsersWithMfa() {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      department: users.department,
      roles: users.roles,
      lastSeenAt: users.lastSeenAt,
      mfaConfirmed: userMfa.confirmed,
      mfaEnrolledAt: userMfa.enrolledAt,
      backupCodesRemaining: userMfa.backupCodeHashes,
    })
    .from(users)
    .leftJoin(userMfa, eq(userMfa.userId, users.id))
    .orderBy(desc(users.lastSeenAt), users.username)

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    email: row.email,
    department: row.department,
    roles: row.roles,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    mfaEnabled: Boolean(row.mfaConfirmed),
    mfaEnrolledAt: row.mfaEnrolledAt?.toISOString() ?? null,
    backupCodesRemaining: row.backupCodesRemaining?.length ?? 0,
  }))
}

export async function resetUserMfa(actorId: string, targetUserId: string) {
  if (actorId === targetUserId) {
    throw new MfaError(
      'Não é possível resetar o próprio MFA por aqui. Use Configurações para trocar o autenticador.',
      'CANNOT_RESET_SELF',
      400
    )
  }

  await db.delete(userMfa).where(eq(userMfa.userId, targetUserId))
  await bumpUserTokenVersion(targetUserId)
}

export async function resetUserMfaBreakGlass(targetUserId: string) {
  await db.delete(userMfa).where(eq(userMfa.userId, targetUserId))
  await bumpUserTokenVersion(targetUserId)
}
