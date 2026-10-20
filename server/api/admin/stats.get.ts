import { eq, count } from 'drizzle-orm'
import { tests, attempts, users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const db = useDb()

  const [[t], [p], [g], [s], [a]] = await Promise.all([
    db.select({ n: count() }).from(tests),
    db.select({ n: count() }).from(tests).where(eq(tests.status, 'PUBLISHED')),
    db.select({ n: count() }).from(attempts).where(eq(attempts.status, 'SUBMITTED')),
    db.select({ n: count() }).from(users).where(eq(users.role, 'student')),
    db.select({ n: count() }).from(attempts)
  ])

  return {
    tests: t?.n ?? 0,
    published: p?.n ?? 0,
    pendingMarking: g?.n ?? 0,
    students: s?.n ?? 0,
    attempts: a?.n ?? 0
  }
})
