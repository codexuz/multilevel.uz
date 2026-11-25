import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { classGroups, classMembers, courseEnrollments, courses, liveLessons, users } from '../database/schema'

/**
 * Online classes on Google Meet: a teacher sets one for a class of theirs (or as a lesson of a
 * course of theirs, courses.ts) at a time and for a length; Mockmee makes the Calendar event and
 * its Meet link with the teacher's Google (google-calendar.ts). The class's students (or the
 * course's) are told on Telegram, reminded half an hour before, and find it on /online with a Join
 * button from a quarter of an hour before it starts until it ends.
 */

type Row = typeof liveLessons.$inferSelect
export const JOIN_EARLY_MINUTES = 15
export const REMIND_MINUTES = 30

/** Who a course is for: a public one, those enrolled; a private one, the students of the teacher's classes. */
export async function courseAudience(course: { id: string, teacherId: string, visibility: string }) {
  const db = useDb()
  if (course.visibility === 'PUBLIC') {
    return (await db.select({ id: courseEnrollments.userId }).from(courseEnrollments).where(eq(courseEnrollments.courseId, course.id))).map(r => r.id)
  }
  return (await db.selectDistinct({ id: classMembers.userId }).from(classMembers).innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classGroups.teacherId, course.teacherId), eq(classGroups.archived, false), sql`${classMembers.userId} <> ${course.teacherId}`))).map(r => r.id)
}

/** The students an online class is for. */
export async function audienceOf(lesson: Pick<Row, 'groupId' | 'courseId'>) {
  const db = useDb()
  if (lesson.groupId) return (await db.select({ id: classMembers.userId }).from(classMembers).where(eq(classMembers.groupId, lesson.groupId))).map(r => r.id)
  if (lesson.courseId) {
    const [c] = await db.select().from(courses).where(eq(courses.id, lesson.courseId)).limit(1)
    return c ? courseAudience(c) : []
  }
  return []
}

/** Where it is held, in words: the class's or the course's name. */
async function whereOf(lesson: Pick<Row, 'groupId' | 'courseId'>) {
  const db = useDb()
  if (lesson.groupId) return (await db.select({ name: classGroups.name }).from(classGroups).where(eq(classGroups.id, lesson.groupId)).limit(1))[0]?.name ?? ''
  if (lesson.courseId) return (await db.select({ name: courses.title }).from(courses).where(eq(courses.id, lesson.courseId)).limit(1))[0]?.name ?? ''
  return ''
}

async function tell(lesson: Row, text: (l: 'en' | 'uz' | 'ru') => string) {
  const ids = await audienceOf(lesson)
  for (const id of ids) await notifyTelegram(id, l => ({ text: text(l), path: '/online', button: MSG.lessonJoin[l] })).catch(() => false)
}

export interface LiveInput { title?: string, description?: string | null, startsAt?: string, durationMinutes?: number }

function values(body: LiveInput, partial: boolean) {
  const out: { title?: string, description?: string | null, startsAt?: Date, durationMinutes?: number } = {}
  if (body.title !== undefined || !partial) {
    const title = String(body.title ?? '').trim().slice(0, 120)
    if (!title) throw createError({ statusCode: 400, message: 'Give the online class a title' })
    out.title = title
  }
  if (body.description !== undefined) out.description = String(body.description ?? '').trim().slice(0, 1000) || null
  if (body.startsAt !== undefined || !partial) {
    const at = new Date(String(body.startsAt))
    if (Number.isNaN(at.getTime())) throw createError({ statusCode: 400, message: 'Pick when it starts' })
    if (at.getTime() < Date.now() - 5 * 60_000) throw createError({ statusCode: 400, message: 'Pick a time that has not passed' })
    if (at.getTime() > Date.now() + 366 * 86_400_000) throw createError({ statusCode: 400, message: 'Pick a time within a year' })
    out.startsAt = at
  }
  if (body.durationMinutes !== undefined || !partial) {
    const n = Math.round(Number(body.durationMinutes ?? 60))
    if (!Number.isFinite(n) || n < 10 || n > 240) throw createError({ statusCode: 400, message: 'An online class is 10 to 240 minutes' })
    out.durationMinutes = n
  }
  return out
}

/** A new online class with its Meet link (created via the shared admin Google account), and its students told. */
export async function createLiveLesson(teacherId: string, where: { groupId?: string, courseId?: string }, body: LiveInput) {
  const v = values(body, false) as Required<Pick<ReturnType<typeof values>, 'title' | 'startsAt' | 'durationMinutes'>> & { description?: string | null }
  const [teacher] = await useDb().select({ email: users.email }).from(users).where(eq(users.id, teacherId)).limit(1)
  const meet = await createMeetEvent(teacherId, { ...v, attendeeEmail: teacher?.email ?? null })
  const [row] = await useDb().insert(liveLessons).values({
    teacherId, groupId: where.groupId ?? null, courseId: where.courseId ?? null,
    title: v.title, description: v.description ?? null, startsAt: v.startsAt, durationMinutes: v.durationMinutes,
    meetUrl: meet.meetUrl, calendarEventId: meet.eventId, calendarLink: meet.htmlLink
  }).returning()
  const place = await whereOf(row!)
  await tell(row!, l => MSG.lessonScheduled(l, row!.title, place, row!.startsAt))
  return row!
}

/** An online class, for its teacher (admins too). */
export async function requireLiveLesson(user: { id: string, role: string }, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Online class not found' })
  const [row] = await useDb().select().from(liveLessons).where(eq(liveLessons.id, id)).limit(1)
  if (!row || (row.teacherId !== user.id && user.role !== 'admin')) throw createError({ statusCode: 404, message: 'Online class not found' })
  return row
}

/** Renamed or moved: the Calendar event follows, and the students hear of a new time. */
export async function updateLiveLesson(row: Row, body: LiveInput) {
  if (row.status !== 'SCHEDULED') throw createError({ statusCode: 409, message: 'This online class is cancelled' })
  const v = values(body, true)
  const next = { title: v.title ?? row.title, description: v.description !== undefined ? v.description : row.description, startsAt: v.startsAt ?? row.startsAt, durationMinutes: v.durationMinutes ?? row.durationMinutes }
  if (row.calendarEventId) await updateMeetEvent(row.teacherId, row.calendarEventId, next)
  const moved = next.startsAt.getTime() !== row.startsAt.getTime()
  const [updated] = await useDb().update(liveLessons).set({ ...next, ...(moved ? { remindedAt: null } : {}), updatedAt: new Date() }).where(eq(liveLessons.id, row.id)).returning()
  if (moved) await tell(updated!, l => MSG.lessonMoved(l, updated!.title, updated!.startsAt))
  return updated!
}

/** Cancelled: off the teacher's calendar, and the students told (if it had not happened yet). */
export async function cancelLiveLesson(row: Row) {
  if (row.status === 'CANCELLED') return row
  if (row.calendarEventId) await cancelMeetEvent(row.teacherId, row.calendarEventId).catch(e => console.warn('[live] calendar event not removed:', e?.message))
  const [updated] = await useDb().update(liveLessons).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(liveLessons.id, row.id)).returning()
  if (row.startsAt.getTime() + row.durationMinutes * 60_000 > Date.now()) await tell(row, l => MSG.lessonCancelled(l, row.title, row.startsAt))
  return updated!
}

const endOf = (r: Pick<Row, 'startsAt' | 'durationMinutes'>) => new Date(r.startsAt.getTime() + r.durationMinutes * 60_000)

/** An online class as the pages show it. The Meet link only to those it is for (the caller checked). */
export function liveView(r: Row & { place?: string | null, teacher?: string | null }, withLink: boolean) {
  const now = Date.now()
  const end = endOf(r).getTime()
  return {
    id: r.id, title: r.title, description: r.description, startsAt: r.startsAt, durationMinutes: r.durationMinutes, status: r.status,
    groupId: r.groupId, courseId: r.courseId, place: r.place ?? null, teacher: r.teacher ?? null,
    state: r.status === 'CANCELLED' ? 'CANCELLED' : now > end ? 'ENDED' : now >= r.startsAt.getTime() ? 'LIVE' : 'UPCOMING',
    joinable: r.status === 'SCHEDULED' && now >= r.startsAt.getTime() - JOIN_EARLY_MINUTES * 60_000 && now <= end,
    meetUrl: withLink && r.status === 'SCHEDULED' ? r.meetUrl : null,
    calendarLink: withLink ? r.calendarLink : null
  }
}

const withPlace = {
  place: sql<string | null>`coalesce(${classGroups.name}, ${courses.title})`,
  teacher: sql<string | null>`coalesce(${users.name}, '@' || ${users.telegramUsername})`
}

/** A teacher's online classes (a class's or a course's, when given): coming ones first, then the last ones. */
export async function teacherLiveLessons(teacherId: string, where: { groupId?: string, courseId?: string } = {}) {
  const rows = await useDb().select({ r: liveLessons, ...withPlace }).from(liveLessons)
    .leftJoin(classGroups, eq(classGroups.id, liveLessons.groupId)).leftJoin(courses, eq(courses.id, liveLessons.courseId))
    .innerJoin(users, eq(users.id, liveLessons.teacherId))
    .where(and(eq(liveLessons.teacherId, teacherId),
      where.groupId ? eq(liveLessons.groupId, where.groupId) : undefined,
      where.courseId ? eq(liveLessons.courseId, where.courseId) : undefined,
      gt(liveLessons.startsAt, new Date(Date.now() - 60 * 86_400_000))))
    .orderBy(desc(liveLessons.startsAt)).limit(200)
  return rows.map(x => liveView({ ...x.r, place: x.place, teacher: x.teacher }, true))
}

/**
 * The online classes a student has: of their classes, and of courses they take (or a private one of
 * their teacher). Only those still to come or on now: a cancelled or finished class is not shown.
 */
export async function studentLiveLessons(userId: string) {
  const db = useDb()
  const myGroups = (await db.select({ id: classMembers.groupId }).from(classMembers).where(eq(classMembers.userId, userId))).map(r => r.id)
  const myTeachers = (await db.selectDistinct({ id: classGroups.teacherId }).from(classMembers).innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classMembers.userId, userId), eq(classGroups.archived, false)))).map(r => r.id)
  const enrolled = (await db.select({ id: courseEnrollments.courseId }).from(courseEnrollments).where(eq(courseEnrollments.userId, userId))).map(r => r.id)
  const reach = [
    myGroups.length ? inArray(liveLessons.groupId, myGroups) : undefined,
    enrolled.length ? and(inArray(liveLessons.courseId, enrolled), eq(courses.visibility, 'PUBLIC')) : undefined,
    myTeachers.length ? and(eq(courses.visibility, 'PRIVATE'), inArray(courses.teacherId, myTeachers)) : undefined
  ].filter(Boolean)
  if (!reach.length) return []
  const rows = await db.select({ r: liveLessons, ...withPlace }).from(liveLessons)
    .leftJoin(classGroups, eq(classGroups.id, liveLessons.groupId)).leftJoin(courses, eq(courses.id, liveLessons.courseId))
    .innerJoin(users, eq(users.id, liveLessons.teacherId))
    .where(and(or(...reach), eq(liveLessons.status, 'SCHEDULED'), sql`${liveLessons.startsAt} + make_interval(mins => ${liveLessons.durationMinutes}) > now()`))
    .orderBy(asc(liveLessons.startsAt)).limit(100)
  return rows.map(x => liveView({ ...x.r, place: x.place, teacher: x.teacher }, true))
}

/** Every five minutes: classes starting within half an hour get their students one reminder. */
export async function sendLiveReminders() {
  const db = useDb()
  const now = new Date()
  const due = await db.select().from(liveLessons).where(and(
    eq(liveLessons.status, 'SCHEDULED'), isNull(liveLessons.remindedAt),
    gt(liveLessons.startsAt, now), lt(liveLessons.startsAt, new Date(now.getTime() + REMIND_MINUTES * 60_000))
  )).limit(200)
  for (const r of due) {
    await db.update(liveLessons).set({ remindedAt: now }).where(eq(liveLessons.id, r.id))
    const minutes = Math.max(1, Math.round((r.startsAt.getTime() - now.getTime()) / 60_000))
    await tell(r, l => MSG.lessonSoon(l, r.title, minutes))
  }
  return { reminded: due.length }
}
