import { eq, sql } from 'drizzle-orm'
import { users, transactions, subscriptions } from '../database/schema'

export const PREMIUM_COIN_COST = 500
const PREMIUM_DAYS = 30

function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}
function yesterdayStr(): string {
  return todayStr(new Date(Date.now() - 86400000))
}

/**
 * Award points/coins for a completed attempt and update the daily streak.
 * Returns the new totals.
 */
export async function awardForAttempt(userId: string, score: number) {
  const db = useDb()
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) return null

  const points = Math.max(0, Math.round(score))
  const coins = Math.floor(points / 5)

  // Streak: same day keeps, yesterday increments, otherwise resets to 1.
  let streak: number
  const today = todayStr()
  if (u.lastActivityDate === today) {
    streak = Math.max(1, u.streakCount)
  } else if (u.lastActivityDate === yesterdayStr()) {
    streak = u.streakCount + 1
  } else {
    streak = 1
  }

  await db.update(users).set({
    points: u.points + points,
    coins: u.coins + coins,
    streakCount: streak,
    lastActivityDate: today,
    updatedAt: new Date()
  }).where(eq(users.id, userId))

  if (points > 0) await db.insert(transactions).values({ userId, currency: 'points', delta: points, reason: 'attempt' })
  if (coins > 0) await db.insert(transactions).values({ userId, currency: 'coins', delta: coins, reason: 'attempt' })

  return { points: u.points + points, coins: u.coins + coins, streak }
}

/**
 * Award a fixed number of points (and derived coins) for a generic activity
 * such as completing a lesson, and bump the daily streak. Returns new totals.
 */
export async function awardActivity(userId: string, points: number, reason: string) {
  const db = useDb()
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) return null

  const pts = Math.max(0, Math.round(points))
  const coins = Math.floor(pts / 5)

  let streak: number
  const today = todayStr()
  if (u.lastActivityDate === today) {
    streak = Math.max(1, u.streakCount)
  } else if (u.lastActivityDate === yesterdayStr()) {
    streak = u.streakCount + 1
  } else {
    streak = 1
  }

  await db.update(users).set({
    points: u.points + pts,
    coins: u.coins + coins,
    streakCount: streak,
    lastActivityDate: today,
    updatedAt: new Date()
  }).where(eq(users.id, userId))

  if (pts > 0) await db.insert(transactions).values({ userId, currency: 'points', delta: pts, reason })
  if (coins > 0) await db.insert(transactions).values({ userId, currency: 'coins', delta: coins, reason })

  return { points: u.points + pts, coins: u.coins + coins, streak }
}

/** Spend coins to unlock a premium subscription. Throws on insufficient balance. */
export async function redeemPremium(userId: string) {
  const db = useDb()
  return await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!u) throw createError({ statusCode: 404, message: 'User not found' })
    if (u.coins < PREMIUM_COIN_COST) {
      throw createError({ statusCode: 400, message: `Not enough coins (need ${PREMIUM_COIN_COST})` })
    }

    await tx.update(users)
      .set({ coins: sql`${users.coins} - ${PREMIUM_COIN_COST}`, updatedAt: new Date() })
      .where(eq(users.id, userId))

    await tx.insert(transactions).values({ userId, currency: 'coins', delta: -PREMIUM_COIN_COST, reason: 'premium unlock' })

    await tx.insert(subscriptions).values({
      userId,
      plan: 'premium',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + PREMIUM_DAYS * 86400000),
      provider: 'coins'
    })

    return { ok: true, coins: u.coins - PREMIUM_COIN_COST }
  })
}
