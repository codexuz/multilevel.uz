import { eq, asc, count } from 'drizzle-orm'
import { attempts, sections, tests, users } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = useDb()
  const p = getPagination(event)

  const [totalRow] = await db.select({ total: count() }).from(attempts)
    .where(eq(attempts.status, 'submitted'))

  const rows = await db.select({
    id: attempts.id,
    submittedAt: attempts.submittedAt,
    sectionType: sections.type,
    sectionTitle: sections.title,
    testTitle: tests.title,
    studentName: users.name
  }).from(attempts)
    .innerJoin(sections, eq(attempts.sectionId, sections.id))
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .innerJoin(users, eq(attempts.userId, users.id))
    .where(eq(attempts.status, 'submitted'))
    .orderBy(asc(attempts.submittedAt))
    .limit(p.pageSize).offset(p.offset)

  return paginate(rows, totalRow?.total ?? 0, p)
})
