import { eq, desc } from 'drizzle-orm'
import { attempts, sections, tests } from '../../database/schema'
import { num } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  const rows = await db.select({
    id: attempts.id,
    status: attempts.status,
    createdAt: attempts.createdAt,
    totalScore: attempts.totalScore,
    maxScore: attempts.maxScore,
    sectionType: sections.type,
    sectionTitle: sections.title,
    testTitle: tests.title
  }).from(attempts)
    .innerJoin(sections, eq(attempts.sectionId, sections.id))
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .where(eq(attempts.userId, user.id))
    .orderBy(desc(attempts.createdAt))
    .limit(50)

  return rows.map(r => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    totalScore: num(r.totalScore),
    maxScore: num(r.maxScore),
    sectionType: r.sectionType,
    sectionTitle: r.sectionTitle,
    testTitle: r.testTitle
  }))
})
