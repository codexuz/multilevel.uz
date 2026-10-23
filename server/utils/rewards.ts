import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, eq, gt, sql } from 'drizzle-orm'
import { partUnlocks, rewardTransactions, testUnlocks, users } from '../database/schema'
import { paymentRequired } from './billing'
import { telegramApi, telegramBotToken } from './telegram'
import { notifyInviteReward } from './notify'
import { openMockOfTest } from './live'

/**
 * Credits that open premium tests, earned instead of bought: a friend invited with your link
 * finishes their first test, or you join the Telegram channel. A credit opens one premium test
 * for good. How many each is worth is set in the environment.
 */

type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const num = (v: string | undefined, fallback: number) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : fallback)

export function rewardRules() {
  return {
    /** To the inviter, when the friend finishes their first test. */
    referrer: num(process.env.REWARD_REFERRER_CREDITS, 2),
    /** To the friend, when they make their account through the link. */
    referred: num(process.env.REWARD_REFERRED_CREDITS, 1),
    /** For joining the Telegram channel, once. */
    channel: num(process.env.REWARD_TELEGRAM_CHANNEL_CREDITS, 1),
    /** What opening one premium test costs. */
    unlockCost: Math.max(1, num(process.env.TEST_UNLOCK_CREDITS, 1)),
    /** Most invites rewarded in 30 days, so made-up accounts cannot farm credits. */
    referralCap: num(process.env.REFERRAL_MONTHLY_CAP, 30)
  }
}

export const REF_COOKIE = 'ml_ref'

export async function rewardBalance(userId: string, db: Db | Tx = useDb()) {
  const [row] = await db.select({ n: sql<number>`coalesce(sum(${rewardTransactions.delta}), 0)::int` })
    .from(rewardTransactions).where(eq(rewardTransactions.userId, userId))
  return row?.n ?? 0
}

export async function unlockedTestIds(userId: string) {
  const rows = await useDb().select({ testId: testUnlocks.testId }).from(testUnlocks).where(eq(testUnlocks.userId, userId))
  return rows.map(r => r.testId)
}

/** The single parts (section items) this user bought in packs. */
export async function unlockedPartIds(userId: string) {
  const rows = await useDb().select({ id: partUnlocks.sectionItemId }).from(partUnlocks).where(eq(partUnlocks.userId, userId))
  return rows.map(r => r.id)
}

/**
 * Whether this user may open this test (or, given `partId`, that one part of it, a section item):
 * it is free, they have Premium, they unlocked it, they bought that part in a pack, or it is a live
 * mock now.
 */
export async function canOpenTest(user: { id: string } | null, test: { id: string, access: string }, premium: boolean, partId?: string | null) {
  if (test.access !== 'PREMIUM' || premium) return true
  if (!user) return false
  // A live mock is open to everyone signed in while it runs.
  if (await openMockOfTest(test.id)) return true
  if (partId) {
    const [part] = await useDb().select({ id: partUnlocks.sectionItemId }).from(partUnlocks)
      .where(and(eq(partUnlocks.userId, user.id), eq(partUnlocks.sectionItemId, partId))).limit(1)
    if (part) return true
  }
  const [row] = await useDb().select({ testId: testUnlocks.testId }).from(testUnlocks)
    .where(and(eq(testUnlocks.userId, user.id), eq(testUnlocks.testId, test.id))).limit(1)
  return !!row
}

/** The user's invite code, made the first time it is asked for. */
export async function referralCodeOf(userId: string): Promise<string> {
  const db = useDb()
  const [row] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1)
  if (row?.code) return row.code
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 7).toLowerCase()
    if (code.length < 6) continue
    const [set] = await db.update(users).set({ referralCode: code })
      .where(and(eq(users.id, userId), sql`${users.referralCode} is null`))
      .returning({ code: users.referralCode })
      .catch(() => [])
    if (set?.code) return set.code
    const [again] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1)
    if (again?.code) return again.code
  }
  throw createError({ statusCode: 500, message: 'Could not make an invite code' })
}

/**
 * A new account made through an invite link: remember who invited them and give them their
 * welcome credits. The inviter is rewarded later, when this friend finishes a test.
 */
export async function acceptReferral(event: H3Event, newUserId: string) {
  const code = getCookie(event, REF_COOKIE)?.trim().toLowerCase()
  if (!code) return
  deleteCookie(event, REF_COOKIE, { path: '/' })
  const db = useDb()
  const [inviter] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1)
  if (!inviter || inviter.id === newUserId) return
  await db.update(users).set({ referredById: inviter.id }).where(and(eq(users.id, newUserId), sql`${users.referredById} is null`))
  const { referred } = rewardRules()
  if (referred > 0) {
    await db.insert(rewardTransactions).values({ userId: newUserId, delta: referred, reason: 'WELCOME' }).onConflictDoNothing()
  }
}

/** A user finished a test: if a friend invited them, that friend earns their credits (once). */
export async function rewardInviter(userId: string) {
  const db = useDb()
  const [me] = await db.select({ inviter: users.referredById }).from(users).where(eq(users.id, userId)).limit(1)
  if (!me?.inviter) return
  const { referrer, referralCap } = rewardRules()
  if (referrer <= 0) return
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(rewardTransactions)
    .where(and(eq(rewardTransactions.userId, me.inviter), eq(rewardTransactions.reason, 'REFERRAL'), gt(rewardTransactions.createdAt, new Date(Date.now() - 30 * 86_400_000))))
  if ((recent?.n ?? 0) >= referralCap) return
  const added = await db.insert(rewardTransactions).values({ userId: me.inviter, delta: referrer, reason: 'REFERRAL', referredUserId: userId })
    .onConflictDoNothing().returning({ id: rewardTransactions.id })
  if (added.length) await notifyInviteReward(me.inviter, referrer).catch(() => {})
}

/** Opens a premium test with credits. Returns the balance left; refuses with 402 when short. */
export async function unlockTest(userId: string, testId: string): Promise<number> {
  const { unlockCost } = rewardRules()
  return useDb().transaction(async (tx) => {
    // One unlock at a time per user, so the balance cannot be spent twice.
    await tx.execute(sql`select 1 from ${users} where ${users.id} = ${userId} for update`)
    const [done] = await tx.select({ testId: testUnlocks.testId }).from(testUnlocks)
      .where(and(eq(testUnlocks.userId, userId), eq(testUnlocks.testId, testId))).limit(1)
    const balance = await rewardBalance(userId, tx)
    if (done) return balance
    if (balance < unlockCost) paymentRequired('CREDIT_REQUIRED', `Opening this test takes ${unlockCost} ${unlockCost === 1 ? 'credit' : 'credits'}`)
    await tx.insert(testUnlocks).values({ userId, testId })
    await tx.insert(rewardTransactions).values({ userId, delta: -unlockCost, reason: 'UNLOCK', testId })
    return balance - unlockCost
  })
}

// ---------- Telegram channel ----------

/** The channel to join: TELEGRAM_CHANNEL is its @username (or numeric id, with TELEGRAM_CHANNEL_URL). */
export function telegramChannel(): { chat: string, url: string } | null {
  const chat = (process.env.TELEGRAM_CHANNEL || '').trim()
  if (!chat || !telegramBotToken()) return null
  const handle = chat.replace(/^https?:\/\/t\.me\//, '@').replace(/^(?!@|-?\d)/, '@')
  const url = process.env.TELEGRAM_CHANNEL_URL || (handle.startsWith('@') ? `https://t.me/${handle.slice(1)}` : '')
  return url ? { chat: handle, url } : null
}

/** Whether this Telegram user is in the channel now. The bot must be an admin of the channel. */
export async function isChannelMember(telegramId: string): Promise<boolean> {
  const channel = telegramChannel()
  const token = telegramBotToken()
  if (!channel || !token) return false
  const res = await telegramApi<{ status: string, is_member?: boolean }>('getChatMember', { chat_id: channel.chat, user_id: telegramId }).catch((e) => {
    console.error('[rewards] getChatMember failed:', e?.data?.description || e?.message)
    throw createError({ statusCode: 502, message: 'Telegram did not answer. Please try again in a minute.' })
  })
  const status = res.result?.status
  return status === 'creator' || status === 'administrator' || status === 'member' || (status === 'restricted' && !!res.result?.is_member)
}
