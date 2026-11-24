import { eq } from 'drizzle-orm'
import { classGroups } from '../../../database/schema'

// Renames a class, updates its exam type/level/description, archives it, or gives it a new join code.
export default defineEventHandler(async (event) => {
  const { group } = await requireClassTeacher(event, String(getRouterParam(event, 'id')))
  const body = (await readBody<{ name?: string, exam?: string, level?: string | null, description?: string | null, archived?: boolean, newCode?: boolean }>(event)) ?? {}
  const set: Partial<typeof classGroups.$inferInsert> = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 80)
    if (!name) throw createError({ statusCode: 400, message: 'Give the class a name' })
    set.name = name
  }
  if (body.exam !== undefined) {
    if (!['IELTS', 'MULTILEVEL'].includes(String(body.exam))) throw createError({ statusCode: 400, message: 'Choose IELTS or CEFR (MULTILEVEL)' })
    set.exam = String(body.exam)
  }
  if (body.level !== undefined) set.level = body.level ? String(body.level).trim().slice(0, 24) || null : null
  if (body.description !== undefined) set.description = body.description ? String(body.description).trim().slice(0, 300) || null : null
  if (typeof body.archived === 'boolean') set.archived = body.archived
  if (body.newCode) set.joinCode = newCode()
  if (!Object.keys(set).length) return group
  const [row] = await useDb().update(classGroups).set(set).where(eq(classGroups.id, group.id)).returning()
  return row
})
