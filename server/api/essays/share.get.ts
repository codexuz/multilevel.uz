import { and, eq } from 'drizzle-orm'
import { attempts, essays } from '../../database/schema'

// Which of an attempt's essays its writer shows as samples (?attemptId=).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const attemptId = String(getQuery(event).attemptId ?? '')
  const rows = await useDb().select({ taskId: essays.taskId, sharedAt: essays.sharedAt, hiddenAt: essays.hiddenAt }).from(essays)
    .innerJoin(attempts, eq(attempts.id, essays.attemptId))
    .where(and(eq(essays.attemptId, attemptId), eq(attempts.userId, user.id)))
  return rows.map(r => ({ taskId: r.taskId, shared: !!r.sharedAt, hidden: !!r.hiddenAt }))
})
