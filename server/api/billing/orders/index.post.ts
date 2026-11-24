import { and, eq } from 'drizzle-orm'
import { orders, packs } from '../../../database/schema'

// A Click order for a test pack, and the Click page to pay it on. A promo code takes its share off
// the price; one that brings it down to nothing opens the pack at once.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ pack?: string, promo?: string }>(event)
  const db = useDb()
  const [pack] = await db.select().from(packs).where(and(eq(packs.slug, String(body?.pack ?? '')), eq(packs.active, true))).limit(1)
  if (!pack) throw createError({ statusCode: 404, message: 'Pack not found' })
  if ((await ownedPackIds(user.id)).has(pack.id)) throw createError({ statusCode: 409, message: 'You already have this pack' })
  const promo = body?.promo ? await usablePromo(body.promo, user.id, `pack:${pack.slug}`) : null
  const price = pack.priceUzs
  const values: typeof orders.$inferInsert = { userId: user.id, packId: pack.id, planName: pack.title, amountUzs: priceWithPromo(promo, price), provider: 'click', promoCodeId: promo?.id ?? null }
  values.discountUzs = price - values.amountUzs!
  const amount = values.amountUzs

  if (amount === 0) {
    await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({ ...values, provider: 'promo', status: 'PAID', paidAt: new Date() }).returning()
      await fulfilOrder(tx, order!, 'GRANT')
    })
    return { paid: true }
  }

  const cfg = clickConfig()
  if (!cfg) throw createError({ statusCode: 409, message: 'Online payment is not available; buy through Telegram', data: { code: 'TELEGRAM' } })
  const [order] = await db.insert(orders).values(values).returning()
  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  return { id: order!.id, number: order!.number, url: clickPaymentUrl(cfg, order!, `${site}/billing/return?order=${order!.id}`) }
})
