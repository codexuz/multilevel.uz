import { eq } from 'drizzle-orm'
import { centres } from '../../../database/schema'

// The owner's word on how the centre shows in the public catalogue: contacts, a few lines, a logo, and whether it is listed.
export default defineEventHandler(async (event) => {
  const { centre, role } = await requireCentreStaff(event, String(getRouterParam(event, 'id')))
  if (role !== 'OWNER') throw createError({ statusCode: 403, message: 'Only the centre\'s owner can change this' })
  const set = listingValues((await readBody<Record<string, unknown>>(event)) ?? {})
  const [row] = await useDb().update(centres).set(set).where(eq(centres.id, centre.id)).returning()
  return listingView(row!)
})
