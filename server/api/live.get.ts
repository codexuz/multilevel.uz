import { and, asc, desc, eq, gt, lte } from 'drizzle-orm'
import { liveMocks, users } from '../database/schema'

// The live mock page of one exam (?exam=IELTS|MULTILEVEL; else the user's own exam, else Multilevel):
// the one open now, the next one, and a leaderboard (?mock=ID for an earlier one; ?brief=1 for just
// the first two, as the menu and the Tests page show them).
export default defineEventHandler(async (event) => {
  const db = useDb()
  const now = new Date()
  const user = await optionalUser(event)
  const q = getQuery(event)
  const id = q.mock
  const [picked] = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? await db.select().from(liveMocks).where(eq(liveMocks.id, id)).limit(1) : []
  const own = !picked && !isExam(q.exam) && user ? (await db.select({ exam: users.exam }).from(users).where(eq(users.id, user.id)).limit(1))[0]?.exam : null
  const exam: Exam = picked ? picked.exam as Exam : isExam(q.exam) ? q.exam : isExam(own) ? own : 'MULTILEVEL'
  // ?brief=1&exam=ANY: either exam (the admin menu's "live" badge).
  const ofExam = q.brief && q.exam === 'ANY' ? undefined : eq(liveMocks.exam, exam)
  const [[live], [next], [last]] = await Promise.all([
    db.select().from(liveMocks).where(and(ofExam, lte(liveMocks.startsAt, now), gt(liveMocks.endsAt, now))).orderBy(asc(liveMocks.endsAt)).limit(1),
    db.select().from(liveMocks).where(and(ofExam, gt(liveMocks.startsAt, now))).orderBy(asc(liveMocks.startsAt)).limit(1),
    db.select().from(liveMocks).where(and(ofExam, lte(liveMocks.endsAt, now))).orderBy(desc(liveMocks.endsAt)).limit(1)
  ])
  if (q.brief) return { exam, live: live ? await mockView(live, now) : null, next: next ? await mockView(next, now) : null, shown: null, board: null }
  const shown = picked && mockState(picked, now) !== 'UPCOMING' ? picked : live ?? last ?? null
  return {
    exam,
    live: live ? await mockView(live, now) : null,
    next: next ? await mockView(next, now) : null,
    shown: shown ? await mockView(shown, now) : null,
    board: shown ? await leaderboard(shown, user?.id ?? null) : null
  }
})
