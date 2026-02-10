import type { Context, Next } from 'hono'
import { apiError } from '../utils/response'
import { verifyJWT } from '../utils/crypto'
import type { UserRole, AppVariables } from '../types'

function extractToken(c: Context): string | null {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return null
}

export const requireAuth = () => async (c: Context<{ Variables: AppVariables }>, next: Next) => {
  const token = extractToken(c)
  if (!token) return c.json(apiError('Authentication required', 401), 401)

  try {
    const payload = verifyJWT<{ userId: number; email: string; role: UserRole; full_name: string }>(token)
    c.set('user', {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      full_name: payload.full_name,
    })
    await next()
  } catch {
    return c.json(apiError('Invalid token', 401), 401)
  }
}

export const requireRole = (allowedRoles: UserRole[]) => async (c: Context<{ Variables: AppVariables }>, next: Next) => {
  const user = c.get('user')
  if (!user) return c.json(apiError('Authentication required', 401), 401)

  if (!allowedRoles.includes(user.role)) {
    return c.json(apiError('Insufficient permissions', 403), 403)
  }

  await next()
}
