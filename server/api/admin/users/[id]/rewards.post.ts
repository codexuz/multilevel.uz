import { eq, sql } from 'drizzle-orm'
import { rewardTransactions, users } from '../../../../database/schema'

/**
 * Gives (or takes back) reward credits, which open premium tests, and extra AI reviews: for
 * support cases and giveaways. The user hears about what they were given in Telegram.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = (await readBody<{ credits?: number, aiReviews?: number }>(event)) ?? {}
  const credits = Math.round(Number(body.credits) || 0)
  const aiReviews = Math.round(Number(body.aiReviews) || 0)
  if (!credits && !aiReviews) throw createError({ statusCode: 400, message: 'Give or take at least one credit or AI review' })
  const db = useDb()
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from ${users} where ${users.id} = ${id} for update`)
    const [u] = await tx.select({ bonus: users.aiBonusReviews }).from(users).where(eq(users.id, id)).limit(1)
    if (!u) throw createError({ statusCode: 404, message: 'User not found' })
    const balance = await rewardBalance(id, tx)
    if (balance + credits < 0) throw createError({ statusCode: 400, message: `They have ${balance} credits; you cannot take more than that` })
    if (credits) await tx.insert(rewardTransactions).values({ userId: id, delta: credits, reason: 'GRANT' })
    const bonus = Math.max(0, u.bonus + aiReviews)
    if (aiReviews) await tx.update(users).set({ aiBonusReviews: bonus }).where(eq(users.id, id))
    return { credits: balance + credits, aiBonusReviews: bonus }
  })
  const gifts = [credits > 0 && `${credits} ${credits === 1 ? 'credit' : 'credits'} to open Premium tests`, aiReviews > 0 && `${aiReviews} extra AI ${aiReviews === 1 ? 'review' : 'reviews'}`].filter(Boolean)
  if (gifts.length) await notifyTelegram(id, { text: `🎁 <b>A gift from Multilevel</b>\nYou received ${gifts.join(' and ')}.`, path: credits > 0 ? '/earn' : '/tests', button: 'Open Multilevel' }).catch(() => {})
  return result
})
