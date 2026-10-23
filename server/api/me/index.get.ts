import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  const db = useDb()
  const [u] = await db.select().from(users).where(eq(users.id, auth.id)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'User not found' })
  const [access, rewardCredits, unlockedTests, unlockedParts, centres, marking] = await Promise.all([accessOf(auth, db), rewardBalance(auth.id), unlockedTestIds(auth.id), unlockedPartIds(auth.id), centresOf(auth.id), markingScopeOf(auth)])

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
    unlockedParts,
    /** Learning centres I belong to, and my role in each (OWNER, TEACHER or STUDENT). */
    centres,
    /** A walk-in's account for a mock session: it sits at its seat and nowhere else. */
    mockOnly: u.mockOnly,
    /** May run mock sessions: teachers, centre owners and admins. */
    /** Switched on by an admin: marks Writing and Speaking of students outside a centre. */
    marker: u.marker,
    /** Has a marking queue: an admin, a marker, or a centre's owner or teacher. */
    marks: marksAnything(marking),
    runsMocks: !u.mockOnly && (u.role === 'teacher' || u.role === 'center_owner' || u.role === 'admin')
  }
})
