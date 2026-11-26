import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { rewardTransactions, tests, users } from '../../database/schema'

// The Earn page: credits, what each way of earning is worth, the invite link and how it has
// gone, the Telegram channel tasks (IELTS & Multilevel), and the latest credits in and out.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  const db = useDb()
  const rules = rewardRules()
  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')

  const [code, credits, [invited], [earned], [me], claimedRows, joinChannels, history] = await Promise.all([
    referralCodeOf(auth.id),
    rewardBalance(auth.id),
    db.select({ n: count() }).from(users).where(eq(users.referredById, auth.id)),
    db.select({ friends: count(), credits: sql<number>`coalesce(sum(${rewardTransactions.delta}), 0)::int` }).from(rewardTransactions)
      .where(and(eq(rewardTransactions.userId, auth.id), eq(rewardTransactions.reason, 'REFERRAL'))),
    db.select({ telegramId: users.telegramId, exam: users.exam }).from(users).where(eq(users.id, auth.id)).limit(1),
    db.select({ reason: rewardTransactions.reason }).from(rewardTransactions)
      .where(and(eq(rewardTransactions.userId, auth.id), inArray(rewardTransactions.reason, ['TELEGRAM_CHANNEL', 'TELEGRAM_CHANNEL_IELTS']))),
    joinableTelegramChannels(),
    db.select({ id: rewardTransactions.id, delta: rewardTransactions.delta, reason: rewardTransactions.reason, createdAt: rewardTransactions.createdAt, test: { slug: tests.slug, title: tests.title } })
      .from(rewardTransactions).leftJoin(tests, eq(tests.id, rewardTransactions.testId))
      .where(eq(rewardTransactions.userId, auth.id)).orderBy(desc(rewardTransactions.createdAt)).limit(20)
  ])

  const claimedSet = new Set(claimedRows.map(r => r.reason))
  const userExam = me?.exam === 'IELTS' || me?.exam === 'MULTILEVEL' ? me.exam : null
  const telegramLinked = !!me?.telegramId

  const channels = rules.channel > 0
    ? [...joinChannels]
        .sort((a, b) => Number(b.exam === userExam) - Number(a.exam === userExam))
        .map(ch => ({
          exam: ch.exam,
          chat: ch.chat,
          title: ch.title,
          url: ch.url,
          telegramLinked,
          claimed: claimedSet.has(ch.reason),
          recommended: userExam ? ch.exam === userExam : false
        }))
    : []

  return {
    credits,
    rules: { referrer: rules.referrer, referred: rules.referred, channel: rules.channel, unlockCost: rules.unlockCost },
    referral: { code, link: `${site}/r/${code}`, invited: invited?.n ?? 0, rewarded: earned?.friends ?? 0, earned: earned?.credits ?? 0 },
    channel: channels[0] ?? null,
    channels,
    history: history.map(h => ({ ...h, test: h.test?.slug ? h.test : null }))
  }
})
