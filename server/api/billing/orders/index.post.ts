import { and, eq } from 'drizzle-orm'
import { orders, plans } from '../../../database/schema'

// A Click order for a plan, and the Click page to pay it on. A promo code takes its share off the
// price; one that brings it down to nothing switches the plan on straight away.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ plan?: string, promo?: string }>(event)
  const db = useDb()
  const [plan] = await db.select().from(plans).where(and(eq(plans.code, String(body?.plan ?? '')), eq(plans.active, true))).limit(1)
  if (!plan) throw createError({ statusCode: 404, message: 'Plan not found' })
  const promo = body?.promo ? await usablePromo(body.promo, user.id, plan.code) : null
  const amount = priceWithPromo(promo, plan.priceUzs)
  const values = {
    userId: user.id, planId: plan.id, planName: plan.name, amountUzs: amount, durationDays: plan.durationDays, credits: plan.credits,
    promoCodeId: promo?.id ?? null, discountUzs: plan.priceUzs - amount
  }

  if (amount === 0) {
    await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({ ...values, provider: 'promo', status: 'PAID', paidAt: new Date() }).returning()
      await fulfilOrder(tx, order!, 'GRANT')
    })
    return { paid: true }
  }

  const cfg = clickConfig()
  if (!cfg) throw createError({ statusCode: 409, message: 'Online payment is not available; buy through Telegram', data: { code: 'TELEGRAM' } })
  const [order] = await db.insert(orders).values({ ...values, provider: 'click' }).returning()
  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  return { id: order!.id, number: order!.number, url: clickPaymentUrl(cfg, order!, `${site}/billing/return?order=${order!.id}`) }
})
