import { eq } from 'drizzle-orm'
import { orders } from '../../../database/schema'

/**
 * Click's Prepare (action 0): Click asks whether this order can be paid. Signed with the secret;
 * answered in Click's own shape, errors included, never with an HTTP error.
 */
export default defineEventHandler(async (event) => {
  const body: Record<string, any> = (await readBody(event).catch(() => null)) ?? {}
  const reply = (code: readonly [number, string], extra: Record<string, unknown> = {}) =>
    ({ click_trans_id: body.click_trans_id, merchant_trans_id: body.merchant_trans_id, ...extra, error: code[0], error_note: code[1] })

  const cfg = clickConfig()
  if (!cfg) return reply(CLICK.BAD_REQUEST)
  if (!clickSignatureValid(cfg, body, false)) return reply(CLICK.SIGN_FAILED)
  if (Number(body.action) !== 0) return reply(CLICK.BAD_ACTION)
  if (String(body.service_id) !== cfg.serviceId) return reply(CLICK.BAD_REQUEST)

  const number = Number(body.merchant_trans_id)
  if (!Number.isInteger(number)) return reply(CLICK.NO_ORDER)
  const db = useDb()
  const [order] = await db.select().from(orders).where(eq(orders.number, number)).limit(1)
  if (!order || order.provider !== 'click') return reply(CLICK.NO_ORDER)
  if (order.status === 'PAID') return reply(CLICK.ALREADY_PAID)
  if (order.status === 'CANCELLED') return reply(CLICK.CANCELLED)
  if (Math.abs(Number(body.amount) - order.amountUzs) > 0.01) return reply(CLICK.BAD_AMOUNT)

  await db.update(orders).set({ clickTransId: String(body.click_trans_id), clickPaydocId: body.click_paydoc_id ? String(body.click_paydoc_id) : null })
    .where(eq(orders.id, order.id))
  return reply(CLICK.OK, { merchant_prepare_id: order.number })
})
