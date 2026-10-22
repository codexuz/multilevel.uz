import { and, eq, sql } from 'drizzle-orm'
import { orders, packs, plans, users } from '../../../../database/schema'

/**
 * A plan or a test pack sold privately (on Telegram, in person): recorded as a paid manual order,
 * and its Premium, credits or tests given at once. The amount is what was actually paid, the price by default.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const userId = getRouterParam(event, 'id')!
  const body = await readBody<{ plan?: string, pack?: string, amountUzs?: number, note?: string }>(event)
  const db = useDb()
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })
  const [pack] = body?.pack ? await db.select().from(packs).where(eq(packs.slug, String(body.pack))).limit(1) : []
  const [plan] = pack ? [] : await db.select().from(plans).where(and(eq(plans.code, String(body?.plan ?? '')))).limit(1)
  if (body?.pack && !pack) throw createError({ statusCode: 404, message: 'Pack not found' })
  if (!pack && !plan) throw createError({ statusCode: 404, message: 'Plan not found' })
  const price = pack ? pack.priceUzs : plan!.priceUzs
  const amount = body?.amountUzs != null && Number.isFinite(Number(body.amountUzs)) ? Math.max(0, Math.round(Number(body.amountUzs))) : price

  const order = await db.transaction(async (tx) => {
    const [created] = await tx.insert(orders).values({
      userId, amountUzs: amount,
      ...(pack
        ? { packId: pack.id, planName: pack.title }
        : { planId: plan!.id, planName: plan!.name, durationDays: plan!.durationDays, credits: plan!.credits }),
      provider: 'manual', status: 'PAID', paidAt: sql`now()`, note: body?.note?.trim().slice(0, 500) || null, grantedById: admin.id
    }).returning()
    await fulfilOrder(tx, created!, 'GRANT')
    return created!
  })
  await publishToUser(userId, { type: 'billing', orderId: order.id }).catch(() => {})
  return { order: orderView(order), access: await accessOf({ id: userId, role: 'student' }) }
})
