import { eq } from 'drizzle-orm'
import { rewardTransactions, users } from '../../database/schema'

// "I've joined": the bot checks the chosen exam's channel members (MULTILEVEL or IELTS), and the
// first time it finds this user's Telegram there, their credits are added. Needs Telegram linked.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  const { channel: reward } = rewardRules()
  const body = await readBody<{ exam?: string }>(event).catch(() => ({ exam: undefined }))
  const requestedExam = body?.exam === 'IELTS' || body?.exam === 'MULTILEVEL' ? body.exam : null

  const channels = await joinableTelegramChannels()
  if (!channels.length || reward <= 0) throw createError({ statusCode: 404, message: 'There is no channel to join right now' })

  const db = useDb()
  const [me] = await db.select({ telegramId: users.telegramId, exam: users.exam }).from(users).where(eq(users.id, auth.id)).limit(1)
  if (!me?.telegramId) throw createError({ statusCode: 400, message: 'Connect your Telegram first, so we can see you joined.', data: { code: 'TELEGRAM_NOT_LINKED' } })

  const preferredExam = requestedExam ?? (me.exam === 'IELTS' || me.exam === 'MULTILEVEL' ? me.exam : 'MULTILEVEL')
  const target = channels.find(c => c.exam === preferredExam) ?? (!requestedExam ? channels[0] : undefined)
  if (!target) throw createError({ statusCode: 404, message: 'There is no channel configured for this exam right now' })

  if (!(await isChannelMember(me.telegramId, target.chat))) {
    throw createError({ statusCode: 409, message: 'We could not find you in the channel yet. Join it, then check again.', data: { code: 'NOT_A_MEMBER' } })
  }

  const added = await db.insert(rewardTransactions).values({ userId: auth.id, delta: reward, reason: target.reason })
    .onConflictDoNothing().returning({ id: rewardTransactions.id })
  return { exam: target.exam, credited: added.length ? reward : 0, credits: await rewardBalance(auth.id) }
})
