import { eq, count } from 'drizzle-orm'
import { tests, attempts, users, courses, enrollments } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = useDb()

  const [[t], [p], [g], [s], [c], [e]] = await Promise.all([
    db.select({ n: count() }).from(tests),
    db.select({ n: count() }).from(tests).where(eq(tests.status, 'published')),
    db.select({ n: count() }).from(attempts).where(eq(attempts.status, 'submitted')),
    db.select({ n: count() }).from(users).where(eq(users.role, 'student')),
    db.select({ n: count() }).from(courses),
    db.select({ n: count() }).from(enrollments)
  ])

  return {
    tests: t?.n ?? 0,
    published: p?.n ?? 0,
    pendingGrading: g?.n ?? 0,
    students: s?.n ?? 0,
    courses: c?.n ?? 0,
    enrollments: e?.n ?? 0
  }
})
