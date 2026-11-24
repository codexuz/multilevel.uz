import type { Locale } from './messages'
import { and, eq } from 'drizzle-orm'
import { promoCodes, promoRedemptions } from '../database/schema'

/**
 * Promo codes: a percentage or an amount off a test pack. A code is checked when the order is made;
 * it counts as used once the order is paid (fulfilOrder records it), or at once for a price brought
 * down to nothing. (Days of Premium codes are no longer accepted: Premium is not sold.)
 */

type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Promo = typeof promoCodes.$inferSelect

export const normalizeCode = (code: unknown) => String(code ?? '').trim().toUpperCase().replace(/\s+/g, '')

const invalid = (message: string) => createError({ statusCode: 400, message, data: { code: 'PROMO_INVALID' } })

/** The code, if it can be used now by this user (on this pack, `pack:<slug>`, when one is given). */
export async function usablePromo(code: unknown, userId: string | null, planCode?: string, db: Db | Tx = useDb()): Promise<Promo> {
  const c = normalizeCode(code)
  if (!c) throw invalid('Type a promo code')
  const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, c)).limit(1)
  if (!promo || !promo.active) throw invalid('This promo code does not exist')
  if (promo.endsAt && promo.endsAt < new Date()) throw invalid('This promo code has expired')
  if (promo.maxUses != null && promo.uses >= promo.maxUses) throw invalid('This promo code has been used up')
  if (promo.kind === 'DAYS') throw invalid('This promo code is no longer valid')
  if (planCode && promo.planCodes.length && !promo.planCodes.includes(planCode)) throw invalid('This promo code is not for this pack')
  if (userId) {
    const [used] = await db.select({ id: promoRedemptions.id }).from(promoRedemptions)
      .where(and(eq(promoRedemptions.promoCodeId, promo.id), eq(promoRedemptions.userId, userId))).limit(1)
    if (used) throw invalid('You have already used this promo code')
  }
  return promo
}

/** What a plan costs with the code (to the nearest 100 so'm). */
export function priceWithPromo(promo: Promo | null, price: number) {
  if (!promo || promo.kind === 'DAYS') return price
  const off = promo.kind === 'PERCENT' ? price * Math.min(100, Math.max(0, promo.value)) / 100 : promo.value
  return Math.max(0, Math.round((price - off) / 100) * 100)
}

/** How the code reads to a buyer: "20% off", "15 000 so'm off", "7 days of Premium". */
/** What a code gives, in words: "20% off", "7 days of Premium" (in Uzbek and Russian too). */
export function promoText(promo: Promo, l: Locale = 'en') {
  const sum = promo.value.toLocaleString('ru-RU').replace(/\s|,/g, ' ')
  if (promo.kind === 'PERCENT') return ({ en: `${promo.value}% off`, uz: `${promo.value}% chegirma`, ru: `скидка ${promo.value}%` })[l]
  if (promo.kind === 'AMOUNT') return ({ en: `${sum} so'm off`, uz: `${sum} so‘m chegirma`, ru: `скидка ${sum} сум` })[l]
  const n = promo.value
  return ({ en: `${n} ${n === 1 ? 'day' : 'days'} of Premium`, uz: `${n} kunlik Premium`, ru: `Premium на ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'дня' : 'дней'}` })[l]
}

export const promoView = (p: Promo) => ({ code: p.code, kind: p.kind, value: p.value, planCodes: p.planCodes, endsAt: p.endsAt, text: promoText(p) })
