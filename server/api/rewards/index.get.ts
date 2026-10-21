import { and, count, desc, eq, sql } from 'drizzle-orm'
import { rewardTransactions, tests, users } from '../../database/schema'

// The Earn page: credits, what each way of earning is worth, the invite link and how it has
// gone, the Telegram channel task, and the latest credits in and out.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  const db = useDb()
  const rules = rewardRules()
  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  const channel = telegramChannel()

  const [code, credits, [invited], [earned], [me], [claimed], history] = await Promise.all([
    referralCodeOf(auth.id),
    rewardBalance(auth.id),
    db.select({ n: count() }).from(users).where(eq(users.referredById, auth.id)),
    db.select({ friends: count(), credits: sql<number>`coalesce(sum(${rewardTransactions.delta}), 0)::int` }).from(rewardTransactions)
      .where(and(eq(rewardTransactions.userId, auth.id), eq(rewardTransactions.reason, 'REFERRAL'))),
    db.select({ telegramId: users.telegramId }).from(users).where(eq(users.id, auth.id)).limit(1),
    db.select({ id: rewardTransactions.id }).from(rewardTransactions)
      .where(and(eq(rewardTransactions.userId, auth.id), eq(rewardTransactions.reason, 'TELEGRAM_CHANNEL'))).limit(1),
    db.select({ id: rewardTransactions.id, delta: rewardTransactions.delta, reason: rewardTransactions.reason, createdAt: rewardTransactions.createdAt, test: { slug: tests.slug, title: tests.title } })
      .from(rewardTransactions).leftJoin(tests, eq(tests.id, rewardTransactions.testId))
      .where(eq(rewardTransactions.userId, auth.id)).orderBy(desc(rewardTransactions.createdAt)).limit(20)
  ])

  return {
    credits,
    rules: { referrer: rules.referrer, referred: rules.referred, channel: rules.channel, unlockCost: rules.unlockCost },
    referral: { code, link: `${site}/r/${code}`, invited: invited?.n ?? 0, rewarded: earned?.friends ?? 0, earned: earned?.credits ?? 0 },
    channel: channel && rules.channel > 0 ? { url: channel.url, telegramLinked: !!me?.telegramId, claimed: !!claimed } : null,
    history: history.map(h => ({ ...h, test: h.test?.slug ? h.test : null }))
  }
})
