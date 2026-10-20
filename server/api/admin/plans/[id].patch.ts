import { eq } from 'drizzle-orm'
import { plans } from '../../../database/schema'

// Changes a plan; orders already made keep the name, price and contents they were sold with.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const values = planValues((await readBody(event)) ?? {}, true)
  try {
    const [plan] = await useDb().update(plans).set(values).where(eq(plans.id, getRouterParam(event, 'id')!)).returning()
    if (!plan) throw createError({ statusCode: 404, message: 'Plan not found' })
    return planView(plan)
  } catch (e: any) {
    if (e?.code === '23505') throw createError({ statusCode: 409, message: 'Another plan already uses this code' })
    throw e
  }
})
