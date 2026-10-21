import { classGroups } from '../../../database/schema'

// A new group (class) in the centre, taught by whoever made it.
export default defineEventHandler(async (event) => {
  const { user, centre } = await requireCentreStaff(event, String(getRouterParam(event, 'id')))
  const name = String((await readBody<{ name?: string }>(event))?.name ?? '').trim().slice(0, 80)
  if (!name) throw createError({ statusCode: 400, message: 'Give the group a name' })
  const [g] = await useDb().insert(classGroups).values({ centreId: centre.id, name, teacherId: user.id, joinCode: newCode() }).returning()
  return g
})
