import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, getAuthUser } from '../middleware/auth.js'
import { authenticateWithLdap, LdapAuthError } from '../services/ldapAuth.js'
import { createSessionToken } from '../services/sessionToken.js'
import { apiError, apiSuccess } from '../utils/response.js'

const loginSchema = z.object({
  username: z.string().trim().min(1).max(256),
  password: z.string().min(1).max(1024),
})

const auth = new Hono()

auth.post('/login', async (c) => {
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

  try {
    const user = await authenticateWithLdap(parsed.data.username, parsed.data.password)
    const { token, expiresIn } = await createSessionToken(user)

    return c.json(
      apiSuccess({
        accessToken: token,
        expiresIn,
        user: {
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
        },
      })
    )
  } catch (error) {
    if (error instanceof LdapAuthError) {
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

function currentUserResponse(c: Parameters<typeof getAuthUser>[0]) {
  const user = getAuthUser(c)
  return c.json(apiSuccess({ user }))
}

auth.get('/me', authMiddleware, (c) => currentUserResponse(c))
auth.get('/validate', authMiddleware, (c) => currentUserResponse(c))
auth.get('/user', authMiddleware, (c) => currentUserResponse(c))

export default auth
