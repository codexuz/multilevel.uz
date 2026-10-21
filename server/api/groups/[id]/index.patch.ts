import { eq } from 'drizzle-orm'
import { classGroups } from '../../../database/schema'

// Renames a group, archives it (nobody can join; it leaves the list), or gives it a new join code.
export default defineEventHandler(async (event) => {
  const { group } = await requireGroupStaff(event, String(getRouterParam(event, 'id')))
  const body = (await readBody<{ name?: string, archived?: boolean, newCode?: boolean }>(event)) ?? {}
  const set: Partial<typeof classGroups.$inferInsert> = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 80)
    if (!name) throw createError({ statusCode: 400, message: 'Give the group a name' })
    set.name = name
  }
  if (typeof body.archived === 'boolean') set.archived = body.archived
  if (body.newCode) set.joinCode = newCode()
  const [row] = await useDb().update(classGroups).set(set).where(eq(classGroups.id, group.id)).returning()
  return row
})
