import { createHash, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import type { orders } from '../database/schema'
import { promoCodes, promoRedemptions, subscriptions } from '../database/schema'
import { userLabel } from './sign-in'

/**
 * What a user may open, and how test packs are paid for. Premium tests open with a pack (bought),
 * with reward credits (earned, rewards.ts), or for someone whose Premium time, bought before
 * subscriptions were stopped, still runs. Nothing else is sold: explanations and AI checks are free
 * with daily limits (explanations.ts, ai-writing.ts). Staff open everything.
 */

type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Mockmee's own staff: admins (who also mark Writing and Speaking and build tests). */
export const isStaffRole = (role?: string | null) => role === 'admin'

export interface Access {
  /** Every premium test open: staff, or Premium time bought before subscriptions were stopped, still running. */
  premium: boolean
  premiumUntil: Date | null
}

/** What a user has now. A guest has nothing. */
export async function accessOf(user: { id: string, role: string } | null, db: Db | Tx = useDb()): Promise<Access> {
  if (!user) return { premium: false, premiumUntil: null }
  const [sub] = await db.select({ endsAt: subscriptions.endsAt }).from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), gt(subscriptions.endsAt, new Date())))
    .orderBy(desc(subscriptions.endsAt)).limit(1)
  return { premium: isStaffRole(user.role) || !!sub, premiumUntil: sub?.endsAt ?? null }
}

/** Refuses with 402 and a code the client turns into the right offer. */
export function paymentRequired(code: 'PREMIUM_REQUIRED' | 'CREDIT_REQUIRED', message: string): never {
  throw createError({ statusCode: 402, message, data: { code } })
}

/** A paid order's pack, once (callers hold the order row locked). */
export async function fulfilOrder(tx: Tx, order: typeof orders.$inferSelect, _reason: 'PURCHASE' | 'GRANT') {
  // A test pack: its tests open for good.
  if (order.packId) await unlockPack(tx, order.userId, order.packId)
  // A promo code on the order now counts as used by this user.
  if (order.promoCodeId) {
    const added = await tx.insert(promoRedemptions).values({ promoCodeId: order.promoCodeId, userId: order.userId, orderId: order.id })
      .onConflictDoNothing().returning({ id: promoRedemptions.id })
    if (added.length) await tx.update(promoCodes).set({ uses: sql`${promoCodes.uses} + 1` }).where(eq(promoCodes.id, order.promoCodeId))
  }
}

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
