import { plans } from '../../../database/schema'

// Every plan, on sale or not, with how Click is set up.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await useDb().select().from(plans).orderBy(plans.position)
  return { plans: rows.map(planView), click: !!clickConfig(), telegram: useRuntimeConfig().public.salesTelegram as string }
})
