import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

const LEVELS = ['B1', 'B2', 'C1']

// Sets (or clears, with null) the day of my exam, and optionally my exam, target level or IELTS band.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = (await readBody<{ examDate?: string | null, targetLevel?: string, exam?: string, targetBand?: number }>(event)) ?? {}
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
  if (body.examDate === null) {
    set.examDate = null
  } else if (body.examDate !== undefined) {
    if (typeof body.examDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.examDate) || Number.isNaN(Date.parse(body.examDate))) {
      throw createError({ statusCode: 400, message: 'Pick the day of your exam' })
    }
    const days = daysBetween(tashkentToday(), body.examDate)
    if (days < 0) throw createError({ statusCode: 400, message: 'That day has passed. Pick the day of your next exam.' })
    if (days > 730) throw createError({ statusCode: 400, message: 'Pick a day within the next two years' })
    set.examDate = body.examDate
    set.planRemindedOn = null
  }
  if (body.targetLevel !== undefined) {
    if (!LEVELS.includes(body.targetLevel)) throw createError({ statusCode: 400, message: 'Pick B1, B2 or C1' })
    // A level replaces a score goal set during onboarding, so the two never disagree.
    set.targetLevel = body.targetLevel
    set.targetScore = null
  }
  if (body.exam !== undefined) {
    if (!isExam(body.exam)) throw createError({ statusCode: 400, message: 'Pick IELTS or Multilevel' })
    set.exam = body.exam
  }
  if (body.targetBand !== undefined) {
    if (!isBand(body.targetBand) || body.targetBand < 4) throw createError({ statusCode: 400, message: 'Pick a band from 4 to 9' })
    set.targetBand = body.targetBand
  }
  await useDb().update(users).set(set).where(eq(users.id, user.id))
  return planOf(user)
})
