import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { ACCESS_COOKIE, verifyAccessToken } from './jwt'
import { revokedTokens, users } from '../database/schema'

export interface AuthUser { id: string, role: string }

function readAccessToken(event: H3Event): string | null {
  const cookie = getCookie(event, ACCESS_COOKIE)
  if (cookie) return cookie
  const header = getRequestHeader(event, 'authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

/** Verify the access token, ensure it isn't blacklisted, return the user. */
export async function requireUser(event: H3Event): Promise<AuthUser> {
  const token = readAccessToken(event)
  if (!token) throw createError({ statusCode: 401, message: 'Unauthorized' })

  let claims
  try {
    claims = await verifyAccessToken(token)
  } catch {
    throw createError({ statusCode: 401, message: 'Invalid or expired token' })
  }

  const db = useDb()
  const [blacklisted] = await db.select().from(revokedTokens).where(eq(revokedTokens.jti, claims.jti)).limit(1)
  if (blacklisted) throw createError({ statusCode: 401, message: 'Token revoked' })

  // Reject banned users immediately (PK lookup), and tokens of accounts that no longer exist
  // (deleted, or merged into another account): those count as signed out.
  const [row] = await db.select({ banned: users.banned }).from(users).where(eq(users.id, claims.sub)).limit(1)
  if (!row) throw createError({ statusCode: 401, message: 'This account no longer exists' })
  if (row.banned) throw createError({ statusCode: 403, message: 'Account banned' })

  return { id: claims.sub, role: claims.role }
}

export async function requireStaff(event: H3Event): Promise<AuthUser> {
  const user = await requireUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return user
}

export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const user = await requireUser(event)
  if (user.role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })
  return user
}

/**
 * A teacher (or an admin): the Teacher panel's data. The token's role is checked against the account,
 * as it may have just become a teacher's (making a first class) while the token still says student.
 */
export async function requireTeacher(event: H3Event): Promise<AuthUser> {
  const user = await requireUser(event)
  if (areaOf(user.role) !== 'student') return user
  const [row] = await useDb().select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1)
  if (!row || areaOf(row.role) === 'student') throw createError({ statusCode: 403, message: 'This is for teachers' })
  return { ...user, role: row.role }
}

/** The signed-in user, or null for a guest (open pages: a guest's answers are checked, not saved). */
export async function optionalUser(event: H3Event): Promise<AuthUser | null> {
  if (!readAccessToken(event)) return null
  try {
    return await requireUser(event)
  } catch {
    return null
  }
}
