import { subscriptions } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ days?: number }>(event)
  const days = body.days && body.days > 0 ? body.days : 30

  const db = useDb()
  await db.insert(subscriptions).values({
    userId: id,
    plan: 'premium',
    status: 'active',
    currentPeriodEnd: new Date(Date.now() + days * 86400000),
    provider: 'manual'
  })
  return { ok: true }
})
