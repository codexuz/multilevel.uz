import { and, asc, desc, eq, gt, lte } from 'drizzle-orm'
import { liveMocks } from '../database/schema'

// The live mock page: the one open now, the next one, and a leaderboard (?mock=ID for an earlier one;
// ?brief=1 for just the first two, as the menu and the Tests page show them).
export default defineEventHandler(async (event) => {
  const db = useDb()
  const now = new Date()
  const user = await optionalUser(event)
  const id = getQuery(event).mock
  const [[live], [next], [last], [picked]] = await Promise.all([
    db.select().from(liveMocks).where(and(lte(liveMocks.startsAt, now), gt(liveMocks.endsAt, now))).orderBy(asc(liveMocks.endsAt)).limit(1),
    db.select().from(liveMocks).where(gt(liveMocks.startsAt, now)).orderBy(asc(liveMocks.startsAt)).limit(1),
    db.select().from(liveMocks).where(lte(liveMocks.endsAt, now)).orderBy(desc(liveMocks.endsAt)).limit(1),
    typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? db.select().from(liveMocks).where(eq(liveMocks.id, id)).limit(1) : Promise.resolve([])
  ])
  if (getQuery(event).brief) return { live: live ? await mockView(live, now) : null, next: next ? await mockView(next, now) : null, shown: null, board: null }
  const shown = picked && mockState(picked, now) !== 'UPCOMING' ? picked : live ?? last ?? null
  return {
    live: live ? await mockView(live, now) : null,
    next: next ? await mockView(next, now) : null,
    shown: shown ? await mockView(shown, now) : null,
    board: shown ? await leaderboard(shown, user?.id ?? null) : null
  }
})
