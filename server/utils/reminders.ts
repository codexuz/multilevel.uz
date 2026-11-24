import { and, desc, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { attempts, users } from '../database/schema'
import { daysBetween, planOf, tashkentToday } from './study-plan'

/**
 * Exam plan reminders, once a morning (Tashkent): on the milestones before the exam (60, 30, 14, 7,
 * 3 days and the day before), good luck on the day, and a nudge after three days without practice
 * (at most every three days). Each names the next goal of the week. At most one message a day.
 */
const MILESTONES = [60, 30, 14, 7, 3, 1]

export async function sendPlanReminders(now = Date.now()) {
  const db = useDb()
  const today = tashkentToday(now)
  const due = await db.select({ id: users.id, role: users.role, examDate: users.examDate, remindedOn: users.planRemindedOn }).from(users).where(and(
    gte(users.examDate, today), isNotNull(users.telegramId), eq(users.telegramNotify, true), eq(users.banned, false),
    or(isNull(users.planRemindedOn), lt(users.planRemindedOn, today))
  )).limit(1000)
  let sent = 0
  for (const u of due) {
    const daysLeft = daysBetween(today, u.examDate!)
    let kind: 'MILESTONE' | 'TODAY' | 'NUDGE' | null = daysLeft === 0 ? 'TODAY' : MILESTONES.includes(daysLeft) ? 'MILESTONE' : null
    if (!kind && (!u.remindedOn || daysBetween(u.remindedOn, today) >= 3)) {
      const [last] = await db.select({ at: attempts.submittedAt }).from(attempts).where(eq(attempts.userId, u.id)).orderBy(desc(attempts.submittedAt)).limit(1)
      if (!last || daysBetween(tashkentToday(last.at.getTime()), today) >= 3) kind = 'NUDGE'
    }
    if (!kind) continue
    await db.update(users).set({ planRemindedOn: today }).where(eq(users.id, u.id))
    const plan = kind === 'TODAY' ? null : await planOf({ id: u.id, role: u.role }, now).catch(() => null)
    if (await notifyPlan(u.id, kind, daysLeft, plan).catch(() => false)) sent++
  }
  return { checked: due.length, sent }
}
