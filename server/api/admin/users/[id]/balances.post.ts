import { eq, sql } from 'drizzle-orm'
import { mockCreditTransactions, rewardTransactions, users } from '../../../../database/schema'

interface Body { testCredits?: number, aiReviews?: number, mockCredits?: number, note?: string }

const amount = (v: unknown) => {
  const n = Math.round(Number(v) || 0)
  if (Math.abs(n) > 10_000) throw createError({ statusCode: 400, message: 'At most 10 000 at a time' })
  return n
}

/**
 * Gives (a plus) or takes back (a minus) what a user holds, all at once: test credits (open premium
 * tests), extra AI checks (after the day's) and their own mock credits
 * (mock sessions they run). Nothing goes below zero. The user hears in Telegram of what was given.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = (await readBody<Body>(event)) ?? {}
  const test = amount(body.testCredits)
  const ai = amount(body.aiReviews)
  const mock = amount(body.mockCredits)
  if (!test && !ai && !mock) throw createError({ statusCode: 400, message: 'Give or take at least one' })
  const note = body.note?.trim().slice(0, 200) || null
  const db = useDb()
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from ${users} where ${users.id} = ${id} for update`)
    const [u] = await tx.select({ bonus: users.aiBonusReviews }).from(users).where(eq(users.id, id)).limit(1)
    if (!u) throw createError({ statusCode: 404, message: 'User not found' })
    const [testNow, mockNow] = await Promise.all([rewardBalance(id, tx), creditBalance(id, tx)])
    const short = (have: number, delta: number, what: string) => {
      if (have + delta < 0) throw createError({ statusCode: 400, message: `They have ${have} ${what}; you cannot take more than that` })
    }
    short(testNow, test, 'test credits')
    short(u.bonus, ai, 'extra AI reviews')
    short(mockNow, mock, 'mock credits')
    if (test) await tx.insert(rewardTransactions).values({ userId: id, delta: test, reason: 'GRANT' })
    if (ai) await tx.update(users).set({ aiBonusReviews: u.bonus + ai }).where(eq(users.id, id))
    if (mock) await tx.insert(mockCreditTransactions).values({ userId: id, delta: mock, reason: 'GRANT', note, createdById: admin.id })
    return { testCredits: testNow + test, aiReviews: u.bonus + ai, mockCredits: mockNow + mock }
  })
  if (test > 0 || ai > 0) {
    await notifyTelegram(id, l => ({ text: MSG.gift(l, Math.max(0, test), Math.max(0, ai), 0), path: test > 0 ? '/earn' : '/tests', button: MSG.open[l] })).catch(() => {})
  }
  return result
})
