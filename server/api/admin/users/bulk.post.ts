import { and, inArray, ne } from 'drizzle-orm'
import { sessions, users } from '../../../database/schema'
import { publishToUser } from '../../../utils/events'

const ROLES = ['student', 'teacher', 'center_owner', 'admin'] as const

/**
 * One action on many users at once: `ROLE` (with `role`), `BAN`, `UNBAN` or `DELETE`. The admin's own
 * account is always left out. Banning ends their sessions and signs open tabs out, as one by one.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<{ ids?: string[], action?: string, role?: string }>(event)) ?? {}
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))].filter(id => /^[0-9a-f-]{36}$/i.test(id) && id !== admin.id).slice(0, 500)
  if (!ids.length) throw createError({ statusCode: 400, message: 'Pick the users' })
  const db = useDb()
  const where = and(inArray(users.id, ids), ne(users.id, admin.id))
  const now = new Date()
  switch (body.action) {
    case 'ROLE': {
      if (!ROLES.includes(body.role as never)) throw createError({ statusCode: 400, message: 'Invalid role' })
      const done = await db.update(users).set({ role: body.role as never, updatedAt: now }).where(where).returning({ id: users.id })
      return { updated: done.length }
    }
    case 'BAN':
    case 'UNBAN': {
      const banned = body.action === 'BAN'
      const done = await db.update(users).set({ banned, updatedAt: now }).where(where).returning({ id: users.id })
      if (banned && done.length) {
        await db.update(sessions).set({ revokedAt: now }).where(inArray(sessions.userId, done.map(d => d.id)))
        await Promise.all(done.map(d => publishToUser(d.id, { type: 'banned' })))
      }
      return { updated: done.length }
    }
    case 'DELETE': {
      const done = await db.delete(users).where(where).returning({ id: users.id })
      return { updated: done.length }
    }
    default:
      throw createError({ statusCode: 400, message: 'Pick what to do' })
  }
})
