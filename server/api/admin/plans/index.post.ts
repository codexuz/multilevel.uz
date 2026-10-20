import { plans } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const values = planValues((await readBody(event)) ?? {}, false)
  try {
    const [plan] = await useDb().insert(plans).values(values as typeof plans.$inferInsert).returning()
    return planView(plan!)
  } catch (e: any) {
    if (e?.code === '23505') throw createError({ statusCode: 409, message: 'Another plan already uses this code' })
    throw e
  }
})
