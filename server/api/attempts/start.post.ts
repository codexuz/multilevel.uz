import { and, eq } from 'drizzle-orm'
import { sections, tests, parts, questions, attempts } from '../../database/schema'
import { num } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { sectionId } = await readBody<{ sectionId: string }>(event)
  if (!sectionId) throw createError({ statusCode: 400, message: 'sectionId required' })

  const db = useDb()
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1)
  if (!section) throw createError({ statusCode: 404, message: 'Section not found' })

  const [test] = await db.select().from(tests).where(eq(tests.id, section.testId)).limit(1)
  if (!test || test.status !== 'published') throw createError({ statusCode: 403, message: 'Test not available' })

  if (test.isPremium && !(await hasActivePremium(user.id))) {
    throw createError({ statusCode: 402, message: 'Premium subscription required' })
  }

  // Resume existing in-progress attempt
  const [existing] = await db.select().from(attempts)
    .where(and(eq(attempts.userId, user.id), eq(attempts.sectionId, sectionId), eq(attempts.status, 'in_progress')))
    .limit(1)
  if (existing) return { attemptId: existing.id, resumed: true }

  // Max score = sum of question points in the section
  const qs = await db.select({ points: questions.points }).from(questions)
    .innerJoin(parts, eq(questions.partId, parts.id))
    .where(eq(parts.sectionId, sectionId))
  const maxScore = qs.reduce((s, q) => s + (num(q.points) ?? 0), 0)

  const [attempt] = await db.insert(attempts).values({
    userId: user.id,
    testId: section.testId,
    sectionId,
    status: 'in_progress',
    maxScore: String(maxScore)
  }).returning({ id: attempts.id })

  return { attemptId: attempt!.id, resumed: false }
})
