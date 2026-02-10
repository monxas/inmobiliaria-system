import type { Context, Next } from 'hono'
import { apiError } from '../utils/response'
import { verifyJWT } from '../utils/crypto'
import type { UserRole, AppVariables, AuthUser } from '../types'

function extractToken(c: Context): string | null {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return null
}

export const requireAuth = () => async (c: Context<{ Variables: AppVariables }>, next: Next): Promise<Response | void> => {
  const token = extractToken(c)
  if (!token) return c.json(apiError('Authentication required', 401), 401)

  try {
    const payload = verifyJWT<{ userId: number; email: string; role: UserRole; fullName: string }>(token)
    const user: AuthUser = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName,
    }
    c.set('user', user)
    await next()
  } catch {
    return c.json(apiError('Invalid token', 401), 401)
  }
}

export const requireRole = (allowedRoles: UserRole[]) => async (c: Context<{ Variables: AppVariables }>, next: Next): Promise<Response | void> => {
  const user = c.get('user')
  if (!user) return c.json(apiError('Authentication required', 401), 401)

  if (!allowedRoles.includes(user.role)) {
    return c.json(apiError('Insufficient permissions', 403), 403)
  }

  await next()
}

/**
 * Middleware to verify the authenticated user owns the resource or is admin.
 * @param getOwnerId - async function that extracts the owner/agent ID from the request context
 */
export const requireOwnership = (
  getOwnerId: (c: Context<{ Variables: AppVariables }>) => Promise<number | null>
) => async (c: Context<{ Variables: AppVariables }>, next: Next): Promise<Response | void> => {
  const user = c.get('user')
  if (!user) return c.json(apiError('Authentication required', 401), 401)

  // Admins bypass ownership check
  if (user.role === 'admin') {
    await next()
    return
  }

  const ownerId = await getOwnerId(c)
  if (ownerId === null) {
    return c.json(apiError('Resource not found', 404), 404)
  }

  if (ownerId !== user.id) {
    return c.json(apiError('You do not have access to this resource', 403), 403)
  }

  await next()
}
