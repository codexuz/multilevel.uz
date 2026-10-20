import { and, eq } from 'drizzle-orm'
import { orders, plans } from '../../../database/schema'

// A Click order for a plan, and the Click page to pay it on.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const cfg = clickConfig()
  if (!cfg) throw createError({ statusCode: 409, message: 'Online payment is not available; buy through Telegram', data: { code: 'TELEGRAM' } })
  const body = await readBody<{ plan?: string }>(event)
  const db = useDb()
  const [plan] = await db.select().from(plans).where(and(eq(plans.code, String(body?.plan ?? '')), eq(plans.active, true))).limit(1)
  if (!plan) throw createError({ statusCode: 404, message: 'Plan not found' })

  const [order] = await db.insert(orders).values({
    userId: user.id, planId: plan.id, planName: plan.name, amountUzs: plan.priceUzs,
    durationDays: plan.durationDays, credits: plan.credits, provider: 'click'
  }).returning()
  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  return { id: order!.id, number: order!.number, url: clickPaymentUrl(cfg, order!, `${site}/billing/return?order=${order!.id}`) }
})
