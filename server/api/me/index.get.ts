import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  const db = useDb()
  const [u] = await db.select().from(users).where(eq(users.id, auth.id)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'User not found' })
  const [access, rewardCredits, unlockedTests, centres] = await Promise.all([accessOf(auth, db), rewardBalance(auth.id), unlockedTestIds(auth.id), centresOf(auth.id)])

  return {
    id: u.id,
    email: u.email,
    telegramUsername: u.telegramUsername,
    telegram: !!u.telegramId,
    telegramNotify: u.telegramNotify,
    telegramBot: u.telegramBotJoined,
    locale: u.locale,
    name: u.name,
    avatarUrl: u.avatarUrl,
    role: u.role,
    currentLevel: u.currentLevel,
    learningDuration: u.learningDuration,
    targetLevel: u.targetLevel,
    targetScore: u.targetScore,
    /** IELTS | MULTILEVEL, or null before they chose. */
    exam: isExam(u.exam) ? u.exam : null,
    targetBand: u.targetBand,
    onboarded: u.onboarded,
    premium: access.premium,
    premiumUntil: access.premiumUntil,
    credits: access.credits,
    rewardCredits,
    unlockCost: rewardRules().unlockCost,
    unlockedTests,
    /** Learning centres I belong to, and my role in each (OWNER, TEACHER or STUDENT). */
    centres
  }
})
