import { and, eq, asc } from 'drizzle-orm'
import { tests, sections, attempts } from '../../database/schema'
import { num } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [test] = await db.select().from(tests).where(eq(tests.id, id)).limit(1)
  if (!test || (test.status !== 'published' && user.role === 'student')) {
    throw createError({ statusCode: 404, message: 'Test not found' })
  }

  const secs = await db.select().from(sections).where(eq(sections.testId, id)).orderBy(asc(sections.orderIndex))
  const myAttempts = await db.select().from(attempts)
    .where(and(eq(attempts.testId, id), eq(attempts.userId, user.id)))

  return {
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      level: test.level,
      isPremium: test.isPremium
    },
    sections: secs.map(s => ({
      id: s.id,
      testId: s.testId,
      type: s.type,
      title: s.title,
      durationMinutes: s.durationMinutes,
      orderIndex: s.orderIndex,
      audioUrl: s.audioUrl
    })),
    attempts: myAttempts.map(a => ({
      id: a.id,
      sectionId: a.sectionId,
      status: a.status,
      totalScore: num(a.totalScore),
      maxScore: num(a.maxScore)
    }))
  }
})
