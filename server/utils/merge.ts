import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import {
  aiReviews, attempts, creditTransactions, orders, parts, rewardTransactions, sessions, speakingParts,
  subscriptions, testUnlocks, tests, users, writingTasks
} from '../database/schema'

/**
 * One person, two accounts: signed up with Google once and with Telegram another time (Telegram
 * gives no email, so the two cannot be matched by themselves). When someone signed in to one
 * account proves they also own the other's Telegram or Google, the other account is merged into
 * the one they are using: results, purchases, Premium, credits and unlocks move over, the two ways
 * of signing in end up on one account, and the other account is deleted.
 *
 * The proof travels as a merge token, signed here, naming the two accounts; it lasts an hour and
 * only the account it names as the one to keep can use it.
 */

const TTL_SECONDS = 60 * 60
const secret = () => process.env.JWT_ACCESS_SECRET || (useRuntimeConfig().jwtAccessSecret as string) || 'multilevel-merge'
const sign = (body: string) => createHmac('sha256', secret()).update(`merge:${body}`).digest('base64url').slice(0, 22)

/** A token that lets `keepId` take in `mergeId`, after its owner proved they own `mergeId` too. */
export function mergeToken(keepId: string, mergeId: string, now = Date.now()) {
  const body = `${keepId}.${mergeId}.${Math.floor(now / 1000) + TTL_SECONDS}`
  return `${body}.${sign(body)}`
}

/** The account a merge token lets `keepId` take in, if it is genuine and recent. */
export function accountToMerge(token: string, keepId: string, now = Date.now()): string | null {
  const [keep, merge, exp, sig] = token.split('.')
  if (!keep || !merge || !exp || !sig || keep !== keepId || merge === keepId) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(sign(`${keep}.${merge}.${exp}`))
  if (a.length !== b.length || !timingSafeEqual(a, b) || Number(exp) < now / 1000) return null
  return merge
}

type UserRow = typeof users.$inferSelect
const RANK: Record<string, number> = { student: 0, examiner: 1, admin: 2 }

/** Why two accounts cannot be merged (each would bring a different Google or Telegram), or null. */
export function mergeConflict(keep: UserRow, other: UserRow): string | null {
  if (keep.email && other.email && keep.email !== other.email) return `That account signs in with another Google account (${other.email}). Sign in to it instead, or keep the two apart.`
  if (keep.telegramId && other.telegramId && keep.telegramId !== other.telegramId) return 'That account signs in with another Telegram account. Sign in to it instead, or keep the two apart.'
  return null
}

/** What the other account would bring, to show before merging. */
export async function mergePreview(otherId: string) {
  const db = useDb()
  const [other] = await db.select().from(users).where(eq(users.id, otherId)).limit(1)
  if (!other) return null
  const [[results], [purchases]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(attempts).where(eq(attempts.userId, otherId)),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.userId, otherId), eq(orders.status, 'PAID')))
  ])
  return {
    name: other.name,
    email: other.email,
    telegramUsername: other.telegramUsername,
    telegram: !!other.telegramId,
    createdAt: other.createdAt,
    results: results?.n ?? 0,
    purchases: purchases?.n ?? 0
  }
}

/** Moves everything of `otherId` onto `keepId` and deletes `otherId`, in one transaction. */
export async function mergeAccounts(keepId: string, otherId: string) {
  if (keepId === otherId) throw createError({ statusCode: 400, message: 'That is the same account' })
  const db = useDb()
  await db.transaction(async (tx) => {
    // Both rows held, lower id first, so two merges at once cannot deadlock.
    await tx.execute(sql`select 1 from ${users} where ${inArray(users.id, [keepId, otherId])} order by ${users.id} for update`)
    const [keep] = await tx.select().from(users).where(eq(users.id, keepId)).limit(1)
    const [other] = await tx.select().from(users).where(eq(users.id, otherId)).limit(1)
    if (!keep || !other) throw createError({ statusCode: 404, message: 'That account no longer exists' })
    const conflict = mergeConflict(keep, other)
    if (conflict) throw createError({ statusCode: 409, message: conflict })

    // Their own things.
    // A live mock counts one section of each skill per person: if both sat the same one, the kept account's stays ranked.
    await tx.execute(sql`update attempts set live_mock_id = null where user_id = ${otherId} and live_mock_id is not null
      and exists (select 1 from attempts k where k.user_id = ${keepId} and k.live_mock_id = attempts.live_mock_id and k.skill = attempts.skill)`)
    for (const table of [attempts, orders, subscriptions, creditTransactions, aiReviews] as const) {
      await tx.update(table).set({ userId: keepId } as any).where(eq(table.userId, otherId))
    }
    // Credits earned once per person (the welcome gift, the channel): keep one.
    await tx.execute(sql`delete from reward_transactions where user_id = ${otherId} and reason in ('WELCOME', 'TELEGRAM_CHANNEL')
      and exists (select 1 from reward_transactions r where r.user_id = ${keepId} and r.reason = reward_transactions.reason)`)
    await tx.update(rewardTransactions).set({ userId: keepId }).where(eq(rewardTransactions.userId, otherId))
    // An inviter is paid once per friend: the other account's invite reward moves over unless the
    // kept account already earned its inviter one.
    await tx.execute(sql`update reward_transactions set referred_user_id = ${keepId} where referred_user_id = ${otherId} and user_id <> ${keepId}
      and not exists (select 1 from reward_transactions r where r.referred_user_id = ${keepId} and r.reason = 'REFERRAL')`)
    // Promo codes used: once per person, so a code both accounts used counts once.
    await tx.execute(sql`delete from promo_redemptions where user_id = ${otherId} and promo_code_id in (select promo_code_id from promo_redemptions where user_id = ${keepId})`)
    await tx.execute(sql`update promo_redemptions set user_id = ${keepId} where user_id = ${otherId}`)
    // Learning centres and classes: the higher role in each centre (owner, then teacher, then student).
    await tx.execute(sql`insert into centre_members (centre_id, user_id, role, created_at)
      select centre_id, ${keepId}, role, created_at from centre_members where user_id = ${otherId}
      on conflict (centre_id, user_id) do update set role = case
        when 'OWNER' in (centre_members.role, excluded.role) then 'OWNER'
        when 'TEACHER' in (centre_members.role, excluded.role) then 'TEACHER' else 'STUDENT' end`)
    await tx.execute(sql`insert into class_members (group_id, user_id, joined_at) select group_id, ${keepId}, joined_at from class_members where user_id = ${otherId} on conflict do nothing`)
    await tx.execute(sql`update class_groups set teacher_id = ${keepId} where teacher_id = ${otherId}`)
    // Unlocked tests: the ones the kept account does not have yet.
    await tx.execute(sql`insert into ${testUnlocks} (user_id, test_id, created_at) select ${keepId}, test_id, created_at from ${testUnlocks} where user_id = ${otherId} on conflict do nothing`)
    // What they did as staff, and whom they invited.
    await tx.update(attempts).set({ examinerId: keepId }).where(eq(attempts.examinerId, otherId))
    await tx.update(orders).set({ grantedById: keepId }).where(eq(orders.grantedById, otherId))
    for (const table of [tests, parts, writingTasks, speakingParts] as const) {
      await tx.update(table).set({ createdById: keepId } as any).where(eq(table.createdById, otherId))
    }
    await tx.update(users).set({ referredById: keepId }).where(and(eq(users.referredById, otherId), ne(users.id, keepId)))
    // The other account's devices are signed out; it is about to go.
    await tx.delete(sessions).where(eq(sessions.userId, otherId))

    // The other account's ways of signing in, and anything the kept one lacks. Unique columns are
    // freed on the other account first.
    await tx.update(users).set({ email: null, telegramId: null, referralCode: null }).where(eq(users.id, otherId))
    await tx.update(users).set({
      email: keep.email ?? other.email,
      telegramId: keep.telegramId ?? other.telegramId,
      telegramUsername: keep.telegramUsername ?? other.telegramUsername,
      telegramBotJoined: keep.telegramBotJoined || (!keep.telegramId && other.telegramBotJoined),
      referralCode: keep.referralCode ?? other.referralCode,
      referredById: keep.referredById ?? (other.referredById === keepId ? null : other.referredById),
      name: keep.name ?? other.name,
      avatarUrl: keep.avatarUrl ?? other.avatarUrl,
      role: (RANK[other.role] ?? 0) > (RANK[keep.role] ?? 0) ? other.role : keep.role,
      banned: keep.banned || other.banned,
      onboarded: keep.onboarded || other.onboarded,
      currentLevel: keep.currentLevel ?? other.currentLevel,
      learningDuration: keep.learningDuration ?? other.learningDuration,
      targetLevel: keep.targetLevel ?? other.targetLevel,
      targetScore: keep.targetScore ?? other.targetScore,
      examDate: keep.examDate ?? other.examDate,
      aiBonusReviews: keep.aiBonusReviews + other.aiBonusReviews,
      updatedAt: new Date()
    }).where(eq(users.id, keepId))
    await tx.delete(users).where(eq(users.id, otherId))
  })
}
