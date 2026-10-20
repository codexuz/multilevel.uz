import { eq, sql } from 'drizzle-orm'
import { orders } from '../../../database/schema'

/**
 * Click's Complete (action 1): the payment went through (error 0) or failed (error < 0). A paid
 * order gives its Premium and credits once, however often Click repeats the call.
 */
export default defineEventHandler(async (event) => {
  const body: Record<string, any> = (await readBody(event).catch(() => null)) ?? {}
  const reply = (code: readonly [number, string], extra: Record<string, unknown> = {}) =>
    ({ click_trans_id: body.click_trans_id, merchant_trans_id: body.merchant_trans_id, ...extra, error: code[0], error_note: code[1] })

  const cfg = clickConfig()
  if (!cfg) return reply(CLICK.BAD_REQUEST)
  if (!clickSignatureValid(cfg, body, true)) return reply(CLICK.SIGN_FAILED)
  if (Number(body.action) !== 1) return reply(CLICK.BAD_ACTION)
  if (String(body.service_id) !== cfg.serviceId) return reply(CLICK.BAD_REQUEST)

  const number = Number(body.merchant_trans_id)
  if (!Number.isInteger(number)) return reply(CLICK.NO_ORDER)
  const db = useDb()
  const [found] = await db.select().from(orders).where(eq(orders.number, number)).limit(1)
  if (!found || found.provider !== 'click') return reply(CLICK.NO_ORDER)
  if (String(body.merchant_prepare_id) !== String(found.number)) return reply(CLICK.NO_TRANSACTION)
  if (found.clickTransId && found.clickTransId !== String(body.click_trans_id)) return reply(CLICK.NO_TRANSACTION)
  if (found.status === 'PAID') return reply(CLICK.ALREADY_PAID)
  if (found.status === 'CANCELLED') return reply(CLICK.CANCELLED)
  if (Math.abs(Number(body.amount) - found.amountUzs) > 0.01) return reply(CLICK.BAD_AMOUNT)

  if (Number(body.error) < 0) {
    await db.update(orders).set({ status: 'CANCELLED', note: String(body.error_note ?? '') || null }).where(eq(orders.id, found.id))
    return reply(CLICK.CANCELLED)
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      // Hold the order while it is paid, so a repeated call waits and then sees it paid.
      const [order] = await tx.select().from(orders).where(eq(orders.id, found.id)).for('update')
      if (!order || order.status === 'PAID') return 'ALREADY_PAID' as const
      if (order.status === 'CANCELLED') return 'CANCELLED' as const
      await tx.update(orders).set({ status: 'PAID', paidAt: sql`now()`, clickTransId: String(body.click_trans_id) }).where(eq(orders.id, order.id))
      await fulfilOrder(tx, order, 'PURCHASE')
      return 'PAID' as const
    })
    if (outcome === 'ALREADY_PAID') return reply(CLICK.ALREADY_PAID)
    if (outcome === 'CANCELLED') return reply(CLICK.CANCELLED)
  } catch (e) {
    console.error('[click] complete failed', e)
    return reply(CLICK.UPDATE_FAILED)
  }

  await publishToUser(found.userId, { type: 'billing', orderId: found.id }).catch(() => {})
  return reply(CLICK.OK, { merchant_confirm_id: found.number })
})
