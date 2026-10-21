import { eq } from 'drizzle-orm'
import { rewardTransactions, users } from '../../database/schema'

// "I've joined": the bot checks the channel's members, and the first time it finds this user's
// Telegram there, their credits are added. Needs Telegram linked to the account.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  const { channel: reward } = rewardRules()
  if (!telegramChannel() || reward <= 0) throw createError({ statusCode: 404, message: 'There is no channel to join right now' })

  const db = useDb()
  const [me] = await db.select({ telegramId: users.telegramId }).from(users).where(eq(users.id, auth.id)).limit(1)
  if (!me?.telegramId) throw createError({ statusCode: 400, message: 'Connect your Telegram first, so we can see you joined.', data: { code: 'TELEGRAM_NOT_LINKED' } })
  if (!(await isChannelMember(me.telegramId))) throw createError({ statusCode: 409, message: 'We could not find you in the channel yet. Join it, then check again.', data: { code: 'NOT_A_MEMBER' } })

  const added = await db.insert(rewardTransactions).values({ userId: auth.id, delta: reward, reason: 'TELEGRAM_CHANNEL' })
    .onConflictDoNothing().returning({ id: rewardTransactions.id })
  return { credited: added.length ? reward : 0, credits: await rewardBalance(auth.id) }
})
