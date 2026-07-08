import { subscriptions } from '../../../../database/schema'
import { sendPush } from '../../../../utils/firebase'
import { publishToUser } from '../../../../utils/events'

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

  // Notify the user: push to their devices + live status update over SSE.
  await sendPush([id], {
    title: 'Premium activated 🎉',
    body: `You now have premium access for ${days} days.`,
    data: { type: 'premium_granted', url: '/dashboard' }
  })
  await publishToUser(id, { type: 'premium', isPremium: true, days })

  return { ok: true }
})
