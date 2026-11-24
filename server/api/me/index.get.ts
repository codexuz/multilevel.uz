import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  const db = useDb()
  const [u] = await db.select().from(users).where(eq(users.id, auth.id)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'User not found' })
  const [access, rewardCredits, unlockedTests, unlockedParts, classes, marking, teaches] = await Promise.all([accessOf(auth, db), rewardBalance(auth.id), unlockedTestIds(auth.id), unlockedPartIds(auth.id), classesOfStudent(auth.id), markingScopeOf(auth), hasClasses(auth.id)])

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
    /** The classes I am in as a student, with their teachers. */
    classes,
    /** I have classes of my own (I teach). */
    teaches,
    /** A walk-in's account for a mock session: it sits at its seat and nowhere else. */
    mockOnly: u.mockOnly,
    /** May run mock sessions: teachers and admins. */
    /** Has a marking queue: an admin, or a teacher with classes. */
    marks: marksAnything(marking),
    /** In a teacher's class: that teacher marks my Writing and Speaking. */
    teacherMarks: classes.length > 0,
    runsMocks: !u.mockOnly && (u.role === 'teacher' || u.role === 'center_owner' || u.role === 'admin' || teaches)
  }
})
