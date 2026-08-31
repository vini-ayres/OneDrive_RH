import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, getAuthUser, getClientMeta, mfaPendingMiddleware, requirePermission } from '../middleware/auth.js'
import { authenticateWithLdap, LdapAuthError } from '../services/ldapAuth.js'
import { createMfaPendingToken, createSessionToken } from '../services/sessionToken.js'
import { ensureUserFromAuth } from '../services/userStore.js'
import {
  confirmEnrollment,
  confirmReplaceAuthenticator,
  getMfaRecord,
  getMfaStatus,
  isMfaConfirmed,
  listUsersWithMfa,
  MfaError,
  regenerateBackupCodes,
  resetUserMfa,
  startEnrollment,
  startReplaceAuthenticator,
  verifyMfaCode,
} from '../services/mfa.js'
import { recordMfaAudit } from '../services/mfaAudit.js'
import {
  clearAuthFailures,
  getRateLimitStatus,
  rateLimitKey,
  recordAuthFailure,
} from '../services/rateLimit.js'
import { apiError, apiSuccess } from '../utils/response.js'
import type { AuthUser } from '../middleware/rbac.js'

const loginSchema = z.object({
  username: z.string().trim().min(1).max(256),
  password: z.string().min(1).max(1024),
})

const codeSchema = z.object({
  code: z.string().trim().min(4).max(32),
})

const adminResetSchema = z.object({
  userId: z.string().trim().min(1).max(256),
})

const auth = new Hono()

function publicUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    groups: user.groups,
    roles: user.roles,
    jobTitle: user.jobTitle || '',
    department: user.department || '',
    officeLocation: user.officeLocation || '',
    mobilePhone: user.mobilePhone || '',
  }
}

function sessionResponse(user: AuthUser, token: string, expiresIn: number, extra?: Record<string, unknown>) {
  return apiSuccess({
    accessToken: token,
    expiresIn,
    user: publicUser(user),
    ...extra,
  })
}

function mfaErrorResponse(error: MfaError) {
  return {
    body: {
      success: false as const,
      error: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
    },
    status: error.status,
  }
}

auth.post('/login', async (c) => {
  const { ipAddress } = getClientMeta(c)
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    const err = apiError('INVALID_BODY', 400)
    return c.json({ ...err.body, message: 'Informe usuário e senha.' }, err.status)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    const err = apiError('INVALID_CREDENTIALS', 400)
    return c.json({ ...err.body, message: 'Informe usuário e senha.' }, err.status)
  }

  const limitKey = rateLimitKey(ipAddress, parsed.data.username)
  const limited = getRateLimitStatus(limitKey)
  if (limited.locked) {
    const err = apiError('TOO_MANY_ATTEMPTS', 429)
    return c.json(
      {
        ...err.body,
        message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
      },
      err.status
    )
  }

  try {
    const user = await authenticateWithLdap(parsed.data.username, parsed.data.password)
    const { tokenVersion } = await ensureUserFromAuth(user)
    const mfa = await getMfaRecord(user.id)
    const purpose = isMfaConfirmed(mfa) ? 'verify' : 'enroll'
    const { token, expiresIn } = await createMfaPendingToken(user, purpose, tokenVersion)
    clearAuthFailures(limitKey)

    return c.json(
      apiSuccess({
        status: purpose === 'enroll' ? 'mfa_enrollment_required' : 'mfa_required',
        mfaToken: token,
        expiresIn,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
      })
    )
  } catch (error) {
    if (error instanceof LdapAuthError) {
      if (error.status === 401) {
        const after = recordAuthFailure(limitKey)
        if (after.locked) {
          const err = apiError('TOO_MANY_ATTEMPTS', 429)
          return c.json(
            {
              ...err.body,
              message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
            },
            err.status
          )
        }
      }
      return c.json(
        {
          success: false as const,
          error: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        error.status
      )
    }

    console.error('[auth] login failed', error instanceof Error ? error.message : error)
    const err = apiError('LDAP_UNAVAILABLE', 500)
    return c.json(
      { ...err.body, message: 'Erro interno ao autenticar. Tente novamente.' },
      500
    )
  }
})

auth.post('/mfa/enroll/start', mfaPendingMiddleware('enroll'), async (c) => {
  const user = getAuthUser(c)
  const { ipAddress, userAgent } = getClientMeta(c)

  try {
    const result = await startEnrollment(user.id, user.username)
    return c.json(apiSuccess(result))
  } catch (error) {
    if (error instanceof MfaError) {
      if (error.code === 'MFA_LOCKED') {
        await recordMfaAudit({
          user,
          action: 'auth.mfa.lockout',
          result: 'denied',
          ipAddress,
          userAgent,
        })
      }
      const err = mfaErrorResponse(error)
      return c.json(err.body, err.status)
    }
    throw error
  }
})

auth.post('/mfa/enroll/confirm', mfaPendingMiddleware('enroll'), async (c) => {
  const user = getAuthUser(c)
  const { ipAddress, userAgent } = getClientMeta(c)
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const err = apiError('INVALID_MFA_CODE', 400)
    return c.json({ ...err.body, message: 'Informe o código de 6 dígitos.' }, err.status)
  }

  try {
    const backupCodes = await confirmEnrollment(user.id, parsed.data.code)
    const { token, expiresIn } = await createSessionToken(user, c.get('verifiedToken').tokenVersion)
    await recordMfaAudit({
      user,
      action: 'auth.mfa.enroll',
      result: 'success',
      ipAddress,
      userAgent,
    })
    return c.json(sessionResponse(user, token, expiresIn, { backupCodes }))
  } catch (error) {
    if (error instanceof MfaError) {
      await recordMfaAudit({
        user,
        action: error.code === 'MFA_LOCKED' ? 'auth.mfa.lockout' : 'auth.mfa.enroll',
        result: 'denied',
        ipAddress,
        userAgent,
      })
      const err = mfaErrorResponse(error)
      return c.json(err.body, err.status)
    }
    throw error
  }
})

auth.post('/mfa/verify', mfaPendingMiddleware('verify'), async (c) => {
  const user = getAuthUser(c)
  const { ipAddress, userAgent } = getClientMeta(c)
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const err = apiError('INVALID_MFA_CODE', 400)
    return c.json({ ...err.body, message: 'Informe o código de verificação.' }, err.status)
  }

  try {
    const result = await verifyMfaCode(user.id, parsed.data.code)
    const { token, expiresIn } = await createSessionToken(user, c.get('verifiedToken').tokenVersion)
    await recordMfaAudit({
      user,
      action: result.method === 'backup' ? 'auth.mfa.backup' : 'auth.mfa.verify',
      result: 'success',
      ipAddress,
      userAgent,
      metadata: { method: result.method },
    })
    return c.json(sessionResponse(user, token, expiresIn))
  } catch (error) {
    if (error instanceof MfaError) {
      await recordMfaAudit({
        user,
        action: error.code === 'MFA_LOCKED' ? 'auth.mfa.lockout' : 'auth.mfa.verify',
        result: 'denied',
        ipAddress,
        userAgent,
      })
      const err = mfaErrorResponse(error)
      return c.json(err.body, err.status)
    }
    throw error
  }
})

auth.get('/mfa/status', authMiddleware, async (c) => {
  const user = getAuthUser(c)
  const status = await getMfaStatus(user.id)
  return c.json(apiSuccess(status))
})

auth.post('/mfa/backup/regenerate', authMiddleware, async (c) => {
  const user = getAuthUser(c)
  const { ipAddress, userAgent } = getClientMeta(c)
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const err = apiError('INVALID_MFA_CODE', 400)
    return c.json({ ...err.body, message: 'Informe o código do autenticador.' }, err.status)
  }

  try {
    const backupCodes = await regenerateBackupCodes(user.id, parsed.data.code)
    await recordMfaAudit({
      user,
      action: 'auth.mfa.backup_regenerate',
      result: 'success',
      ipAddress,
      userAgent,
    })
    return c.json(apiSuccess({ backupCodes }))
  } catch (error) {
    if (error instanceof MfaError) {
      await recordMfaAudit({
        user,
        action: error.code === 'MFA_LOCKED' ? 'auth.mfa.lockout' : 'auth.mfa.backup_regenerate',
        result: 'denied',
        ipAddress,
        userAgent,
      })
      const err = mfaErrorResponse(error)
      return c.json(err.body, err.status)
    }
    throw error
  }
})

auth.post('/mfa/replace/start', authMiddleware, async (c) => {
  const user = getAuthUser(c)
  const { ipAddress, userAgent } = getClientMeta(c)
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const err = apiError('INVALID_MFA_CODE', 400)
    return c.json({ ...err.body, message: 'Informe o código do autenticador atual.' }, err.status)
  }

  try {
    const result = await startReplaceAuthenticator(user.id, user.username, parsed.data.code)
    return c.json(apiSuccess(result))
  } catch (error) {
    if (error instanceof MfaError) {
      if (error.code === 'MFA_LOCKED') {
        await recordMfaAudit({
          user,
          action: 'auth.mfa.lockout',
          result: 'denied',
          ipAddress,
          userAgent,
        })
      }
      const err = mfaErrorResponse(error)
      return c.json(err.body, err.status)
    }
    throw error
  }
})

auth.post('/mfa/replace/confirm', authMiddleware, async (c) => {
  const user = getAuthUser(c)
  const { ipAddress, userAgent } = getClientMeta(c)
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const err = apiError('INVALID_MFA_CODE', 400)
    return c.json({ ...err.body, message: 'Informe o código do novo autenticador.' }, err.status)
  }

  try {
    await confirmReplaceAuthenticator(user.id, parsed.data.code)
    await recordMfaAudit({
      user,
      action: 'auth.mfa.replace',
      result: 'success',
      ipAddress,
      userAgent,
    })
    return c.json(apiSuccess({ replaced: true }))
  } catch (error) {
    if (error instanceof MfaError) {
      await recordMfaAudit({
        user,
        action: error.code === 'MFA_LOCKED' ? 'auth.mfa.lockout' : 'auth.mfa.replace',
        result: 'denied',
        ipAddress,
        userAgent,
      })
      const err = mfaErrorResponse(error)
      return c.json(err.body, err.status)
    }
    throw error
  }
})

auth.get('/mfa/admin/users', authMiddleware, requirePermission('canManageUsers'), async (c) => {
  const users = await listUsersWithMfa()
  return c.json(apiSuccess({ users }))
})

auth.post('/mfa/admin/reset', authMiddleware, requirePermission('canManageUsers'), async (c) => {
  const actor = getAuthUser(c)
  const { ipAddress, userAgent } = getClientMeta(c)
  const parsed = adminResetSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    const err = apiError('INVALID_BODY', 400)
    return c.json({ ...err.body, message: 'Informe o usuário a resetar.' }, err.status)
  }

  try {
    await resetUserMfa(actor.id, parsed.data.userId)
    await recordMfaAudit({
      user: actor,
      action: 'auth.mfa.reset',
      result: 'success',
      ipAddress,
      userAgent,
      metadata: { targetUserId: parsed.data.userId },
    })
    return c.json(apiSuccess({ reset: true, userId: parsed.data.userId }))
  } catch (error) {
    if (error instanceof MfaError) {
      const err = mfaErrorResponse(error)
      return c.json(err.body, err.status)
    }
    throw error
  }
})

function currentUserResponse(c: Parameters<typeof getAuthUser>[0]) {
  const user = getAuthUser(c)
  return c.json(apiSuccess({ user }))
}

auth.get('/me', authMiddleware, (c) => currentUserResponse(c))
auth.get('/validate', authMiddleware, (c) => currentUserResponse(c))
auth.get('/user', authMiddleware, (c) => currentUserResponse(c))

export default auth
