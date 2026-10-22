import { createHash, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import type { orders } from '../database/schema'
import { creditTransactions, plans, promoCodes, promoRedemptions, subscriptions, users } from '../database/schema'
import { userLabel } from './sign-in'
import { hasCentreSeat } from './centres'

/**
 * Freemium: what a user may do, and how plans are paid for. Premium (time) opens premium tests
 * and the explanations in every review; a marking credit is spent when a Writing or Speaking
 * section is handed in for an examiner. Staff are never asked to pay.
 */

type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export const isStaffRole = (role?: string | null) => role === 'admin' || role === 'examiner'

export interface Access {
  premium: boolean
  premiumUntil: Date | null
  credits: number
}

/** What a user has now (paid for, or through their learning centre). A guest has nothing. */
export async function accessOf(user: { id: string, role: string } | null, db: Db | Tx = useDb()): Promise<Access> {
  if (!user) return { premium: false, premiumUntil: null, credits: 0 }
  const [[sub], [balance], seat] = await Promise.all([
    db.select({ endsAt: subscriptions.endsAt }).from(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), gt(subscriptions.endsAt, new Date())))
      .orderBy(desc(subscriptions.endsAt)).limit(1),
    db.select({ n: sql<number>`coalesce(sum(${creditTransactions.delta}), 0)::int` }).from(creditTransactions)
      .where(eq(creditTransactions.userId, user.id)),
    hasCentreSeat(user.id, db)
  ])
  return {
    // A seat at a learning centre whose licence runs gives Premium too.
    premium: isStaffRole(user.role) || !!sub || seat,
    premiumUntil: sub?.endsAt ?? null,
    credits: balance?.n ?? 0
  }
}

/** Refuses with 402 and a code the client turns into the right offer. */
export function paymentRequired(code: 'PREMIUM_REQUIRED' | 'CREDIT_REQUIRED', message: string): never {
  throw createError({ statusCode: 402, message, data: { code } })
}

/** A paid order's Premium, credits and pack, once (callers hold the order row locked). */
export async function fulfilOrder(tx: Tx, order: typeof orders.$inferSelect, reason: 'PURCHASE' | 'GRANT') {
  if (order.durationDays > 0) {
    // Buying while Premium runs starts the new stretch where the current one ends.
    const [current] = await tx.select({ endsAt: subscriptions.endsAt }).from(subscriptions)
      .where(and(eq(subscriptions.userId, order.userId), gt(subscriptions.endsAt, new Date())))
      .orderBy(desc(subscriptions.endsAt)).limit(1)
    const startsAt = current?.endsAt ?? new Date()
    const endsAt = new Date(startsAt.getTime() + order.durationDays * 86_400_000)
    await tx.insert(subscriptions).values({ userId: order.userId, orderId: order.id, startsAt, endsAt })
  }
  if (order.credits > 0) {
    await tx.insert(creditTransactions).values({ userId: order.userId, delta: order.credits, reason, orderId: order.id })
  }
  // A test pack: its tests open for good.
  if (order.packId) await unlockPack(tx, order.userId, order.packId)
  // A promo code on the order now counts as used by this user.
  if (order.promoCodeId) {
    const added = await tx.insert(promoRedemptions).values({ promoCodeId: order.promoCodeId, userId: order.userId, orderId: order.id })
      .onConflictDoNothing().returning({ id: promoRedemptions.id })
    if (added.length) await tx.update(promoCodes).set({ uses: sql`${promoCodes.uses} + 1` }).where(eq(promoCodes.id, order.promoCodeId))
  }
}

/**
 * Holds a user's credits for the rest of the transaction and says whether one is left. Call it
 * before anything else in the transaction writes rows that point at the user (an attempt does),
 * or two hand-ins deadlock instead of one waiting for the other.
 */
export async function holdCredits(tx: Tx, userId: string) {
  await tx.execute(sql`select 1 from ${users} where ${users.id} = ${userId} for update`)
  const [balance] = await tx.select({ n: sql<number>`coalesce(sum(${creditTransactions.delta}), 0)::int` })
    .from(creditTransactions).where(eq(creditTransactions.userId, userId))
  return (balance?.n ?? 0) >= 1
}

/** One marking credit spent on an attempt, after holdCredits said there was one. */
export async function spendCredit(tx: Tx, userId: string, attemptId: string) {
  await tx.insert(creditTransactions).values({ userId, delta: -1, reason: 'MARKING', attemptId })
}

export async function activePlans() {
  return useDb().select().from(plans).where(eq(plans.active, true)).orderBy(plans.position)
}

export const planView = (p: typeof plans.$inferSelect) => ({
  id: p.id, code: p.code, name: p.name, description: p.description, priceUzs: p.priceUzs,
  durationDays: p.durationDays, credits: p.credits, featured: p.featured, active: p.active, position: p.position
})

export const orderView = (o: typeof orders.$inferSelect & { user?: { id: string, name: string | null, email: string | null, telegramUsername: string | null } | null }) => ({
  id: o.id, number: o.number, planName: o.planName, packId: o.packId, amountUzs: o.amountUzs, durationDays: o.durationDays, credits: o.credits,
  provider: o.provider, status: o.status, note: o.note, paidAt: o.paidAt, createdAt: o.createdAt,
  user: o.user ? { id: o.user.id, name: userLabel(o.user), email: o.user.email, telegramUsername: o.user.telegramUsername } : undefined
})

// ─── Click.uz (SHOP API) ─────────────────────────────────────────────────────────────────

export interface ClickConfig { serviceId: string, merchantId: string, secretKey: string, merchantUserId?: string }

/** Click's credentials, or null when they are not set and plans are sold on Telegram instead. */
export function clickConfig(): ClickConfig | null {
  const c = useRuntimeConfig()
  const serviceId = process.env.CLICK_SERVICE_ID || (c.clickServiceId as string | undefined)
  const merchantId = process.env.CLICK_MERCHANT_ID || (c.clickMerchantId as string | undefined)
  const secretKey = process.env.CLICK_SECRET_KEY || (c.clickSecretKey as string | undefined)
  if (!serviceId || !merchantId || !secretKey) return null
  return { serviceId, merchantId, secretKey, merchantUserId: process.env.CLICK_MERCHANT_USER_ID || (c.clickMerchantUserId as string | undefined) || undefined }
}

/** Where the buyer pays: Click's page for this order, coming back to `returnUrl`. */
export function clickPaymentUrl(cfg: ClickConfig, order: { number: number, amountUzs: number }, returnUrl: string) {
  const url = new URL('https://my.click.uz/services/pay')
  url.searchParams.set('service_id', cfg.serviceId)
  url.searchParams.set('merchant_id', cfg.merchantId)
  url.searchParams.set('amount', order.amountUzs.toFixed(2))
  url.searchParams.set('transaction_param', String(order.number))
  url.searchParams.set('return_url', returnUrl)
  if (cfg.merchantUserId) url.searchParams.set('merchant_user_id', cfg.merchantUserId)
  return url.toString()
}

/** Click's request signature: md5 of the fields in Click's order, the secret third. */
export function clickSignatureValid(cfg: ClickConfig, body: Record<string, any>, withPrepareId: boolean) {
  const parts = [body.click_trans_id, body.service_id, cfg.secretKey, body.merchant_trans_id]
  if (withPrepareId) parts.push(body.merchant_prepare_id)
  parts.push(body.amount, body.action, body.sign_time)
  const expected = createHash('md5').update(parts.map(p => p ?? '').join('')).digest('hex')
  const given = String(body.sign_string ?? '')
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

/** Click's error codes (SHOP API). */
export const CLICK = {
  OK: [0, 'Success'],
  SIGN_FAILED: [-1, 'SIGN CHECK FAILED'],
  BAD_AMOUNT: [-2, 'Incorrect parameter amount'],
  BAD_ACTION: [-3, 'Action not found'],
  ALREADY_PAID: [-4, 'Already paid'],
  NO_ORDER: [-5, 'User does not exist'],
  NO_TRANSACTION: [-6, 'Transaction does not exist'],
  UPDATE_FAILED: [-7, 'Failed to update user'],
  BAD_REQUEST: [-8, 'Error in request from click'],
  CANCELLED: [-9, 'Transaction cancelled']
} as const

/** A plan as an admin writes it; only the fields given are kept. */
export function planValues(body: Record<string, any>, partial: boolean) {
  const out: Partial<typeof plans.$inferInsert> = {}
  const int = (v: unknown, min: number, max: number) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : null
  if (body.code !== undefined || !partial) {
    const code = String(body.code ?? '').trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(code)) throw createError({ statusCode: 400, message: 'The code is 2–40 letters, digits or dashes' })
    out.code = code
  }
  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? '').trim()
    if (!name) throw createError({ statusCode: 400, message: 'The plan needs a name' })
    out.name = name.slice(0, 120)
  }
  if (body.description !== undefined) out.description = String(body.description ?? '').trim().slice(0, 500) || null
  if (body.priceUzs !== undefined || !partial) {
    const price = int(body.priceUzs, 1000, 100_000_000)
    if (price == null) throw createError({ statusCode: 400, message: 'The price is at least 1,000 so\'m' })
    out.priceUzs = price
  }
  if (body.durationDays !== undefined) out.durationDays = int(body.durationDays, 0, 3650) ?? 0
  if (body.credits !== undefined) out.credits = int(body.credits, 0, 1000) ?? 0
  if (body.featured !== undefined) out.featured = !!body.featured
  if (body.active !== undefined) out.active = !!body.active
  if (body.position !== undefined) out.position = int(body.position, 0, 1000) ?? 1
  if (!partial && !out.durationDays && !out.credits) throw createError({ statusCode: 400, message: 'A plan gives days of Premium, marking credits, or both' })
  return out
}
