import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { attempts, classGroups, classMembers, courseEnrollments, courseLessons, courses, lessonProgress, liveLessons, tests, users } from '../database/schema'

/**
 * Teachers' courses: lessons in order, each with any of a text, a video, a test to do (a section or
 * one part), PDFs and an online class on Google Meet (live-lessons.ts). A course is
 * - PRIVATE: for the students of the teacher's classes only (they see it once it is published);
 * - PUBLIC: in the catalogue (/courses) once published; any signed-in user enrolls, free.
 * The teacher sees who takes it and how far each has got (lessons done, tasks handed in).
 */

type Course = typeof courses.$inferSelect
type Lesson = typeof courseLessons.$inferSelect
type Viewer = { id: string, role: string } | null

export const VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const
const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']

const nameOf = (u: { name: string | null, telegramUsername: string | null }) => u.name || (u.telegramUsername ? `@${u.telegramUsername}` : 'Teacher')

/** Whether the user is in one of the teacher's classes (not archived). */
export async function studiesWith(userId: string, teacherId: string) {
  if (userId === teacherId) return false
  const [row] = await useDb().select({ one: sql<number>`1` }).from(classMembers).innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classMembers.userId, userId), eq(classGroups.teacherId, teacherId), eq(classGroups.archived, false))).limit(1)
  return !!row
}

export interface CourseAccess {
  /** The teacher (or an admin): everything, published or not. */
  teaches: boolean
  /** May see the course's page (its lessons' titles). */
  see: boolean
  /** May open its lessons (a private course's student; an enrolled learner of a public one). */
  learn: boolean
  enrolled: boolean
  /** A public course they have not enrolled in yet. */
  canEnroll: boolean
}

export async function accessTo(viewer: Viewer, course: Course): Promise<CourseAccess> {
  const teaches = !!viewer && (viewer.id === course.teacherId || viewer.role === 'admin')
  if (teaches) return { teaches, see: true, learn: true, enrolled: false, canEnroll: false }
  if (!course.published) return { teaches, see: false, learn: false, enrolled: false, canEnroll: false }
  if (course.visibility === 'PRIVATE') {
    const student = !!viewer && await studiesWith(viewer.id, course.teacherId)
    return { teaches, see: student, learn: student, enrolled: student, canEnroll: false }
  }
  const [row] = viewer ? await useDb().select({ one: sql<number>`1` }).from(courseEnrollments).where(and(eq(courseEnrollments.courseId, course.id), eq(courseEnrollments.userId, viewer.id))).limit(1) : []
  return { teaches, see: true, learn: !!row, enrolled: !!row, canEnroll: !!viewer && !row }
}

/** A course by id or address, or 404. */
export async function findCourse(key: string) {
  const db = useDb()
  const byId = /^[0-9a-f-]{36}$/i.test(key)
  const [c] = await db.select().from(courses).where(byId ? eq(courses.id, key) : eq(courses.slug, key)).limit(1)
  if (!c) throw createError({ statusCode: 404, message: 'Course not found' })
  return c
}

/** A course, for its teacher (or an admin). */
export async function requireCourseTeacher(event: H3Event, key: string) {
  const user = await requireUser(event)
  const course = await findCourse(key)
  if (course.teacherId !== user.id && user.role !== 'admin') throw createError({ statusCode: 404, message: 'Course not found' })
  return { user, course }
}

/** A lesson and its course, for the course's teacher. */
export async function requireLessonTeacher(event: H3Event, lessonId: string) {
  const lesson = await findLesson(lessonId)
  const { user, course } = await requireCourseTeacher(event, lesson.courseId)
  return { user, course, lesson }
}

export async function findLesson(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Lesson not found' })
  const [l] = await useDb().select().from(courseLessons).where(eq(courseLessons.id, id)).limit(1)
  if (!l) throw createError({ statusCode: 404, message: 'Lesson not found' })
  return l
}

// ---------- writing ----------

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/** The course's fields as the editor sends them; only those given are kept. */
export function courseValues(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<typeof courses.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = text(body.title, 120)
    if (!title) throw createError({ statusCode: 400, message: 'Give the course a title' })
    out.title = title
  }
  if (body.summary !== undefined) out.summary = text(body.summary, 400) || null
  if (body.exam !== undefined) out.exam = isExam(body.exam) ? body.exam : null
  if (body.level !== undefined) out.level = ['A1', 'A2', 'B1', 'B2', 'C1'].includes(String(body.level)) ? String(body.level) : null
  if (body.visibility !== undefined) {
    if (!VISIBILITIES.includes(body.visibility as never)) throw createError({ statusCode: 400, message: 'Private or public?' })
    out.visibility = String(body.visibility)
  }
  if (body.published !== undefined) out.published = !!body.published
  return out
}

export async function createCourse(userId: string, body: Record<string, unknown>) {
  const v = courseValues(body, false)
  return useDb().transaction(async (tx) => {
    const [u] = await tx.select({ mockOnly: users.mockOnly }).from(users).where(eq(users.id, userId)).limit(1)
    if (!u || u.mockOnly) throw createError({ statusCode: 403, message: 'This account cannot make courses' })
    await raiseToTeacher(tx, userId)
    const slug = `${slugify(v.title!).replace(/-+$/, '').slice(0, 60) || 'course'}-${randomBytes(3).toString('hex')}`
    const [c] = await tx.insert(courses).values({ ...v, title: v.title!, teacherId: userId, slug }).returning()
    return c!
  })
}

/** Only an http(s) address. */
function link(v: unknown) {
  const s = text(v, 500)
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('scheme')
    return u.toString()
  } catch {
    throw createError({ statusCode: 400, message: 'The video is a web address (https://…)' })
  }
}

/** A lesson's fields as the editor sends them; only those given are kept. */
export async function lessonValues(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<typeof courseLessons.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = text(body.title, 160)
    if (!title) throw createError({ statusCode: 400, message: 'Give the lesson a title' })
    out.title = title
  }
  if (body.body !== undefined) out.body = sanitizeRichText(String(body.body ?? '')).slice(0, 100_000) || null
  if (body.videoUrl !== undefined) out.videoUrl = link(body.videoUrl)
  if (body.task !== undefined) {
    const task = body.task as { testId?: string, skill?: string, partNumber?: number | null } | null
    if (!task?.testId) {
      Object.assign(out, { taskTestId: null, taskSkill: null, taskPartNumber: null })
    } else {
      const skill = String(task.skill ?? '').toUpperCase()
      if (!SKILLS.includes(skill)) throw createError({ statusCode: 400, message: 'Pick the task\'s skill' })
      const test = await loadTest({ id: String(task.testId) }, { publishedOnly: true }).catch(() => null)
      if (!test) throw createError({ statusCode: 400, message: 'Pick a published test' })
      const section = test.sections.find((s: any) => s.skill === skill && s.items?.length)
      if (!section) throw createError({ statusCode: 400, message: 'That test has no such section' })
      const part = task.partNumber ? Math.round(Number(task.partNumber)) : null
      if (part && !pickPart(section, part)) throw createError({ statusCode: 400, message: 'That part is not in the test' })
      Object.assign(out, { taskTestId: test.id, taskSkill: skill, taskPartNumber: part })
    }
  }
  if (body.files !== undefined) {
    const files = (Array.isArray(body.files) ? body.files : []).slice(0, 20).map((f: any) => ({
      name: text(f?.name, 160) || 'File',
      url: String(f?.url ?? ''),
      size: Number.isFinite(Number(f?.size)) ? Math.round(Number(f.size)) : null
    }))
    // Only files uploaded here (for courses).
    if (files.some(f => !s3KeyFromUrl(f.url)?.startsWith('courses/'))) throw createError({ statusCode: 400, message: 'Upload the files here' })
    out.files = files
  }
  return out
}

export async function addLesson(course: Course, body: Record<string, unknown>) {
  const v = await lessonValues(body, false)
  const db = useDb()
  const [last] = await db.select({ n: sql<number>`coalesce(max(${courseLessons.position}), 0)::int` }).from(courseLessons).where(eq(courseLessons.courseId, course.id))
  const [l] = await db.insert(courseLessons).values({ ...v, title: v.title!, courseId: course.id, position: (last?.n ?? 0) + 1 }).returning()
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return l!
}

/** Puts the lessons in the order given (ids of this course's lessons). */
export async function reorderLessons(course: Course, ids: string[]) {
  const db = useDb()
  const mine = (await db.select({ id: courseLessons.id }).from(courseLessons).where(eq(courseLessons.courseId, course.id))).map(r => r.id)
  if (ids.length !== mine.length || ids.some(id => !mine.includes(id))) throw createError({ statusCode: 400, message: 'Give every lesson of the course, in order' })
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(courseLessons).set({ position: i + 1 }).where(eq(courseLessons.id, id))
  })
}

// ---------- reading ----------

const what = (l: Lesson) => ({ text: !!l.body, video: !!l.videoUrl, task: !!l.taskTestId, files: Array.isArray(l.files) && l.files.length > 0, live: !!l.liveLessonId })

/** Whether each of these lessons' tasks has been handed in by the user. */
async function tasksDone(userId: string, lessons: Lesson[]) {
  const withTask = lessons.filter(l => l.taskTestId && l.taskSkill)
  if (!withTask.length) return new Set<string>()
  const rows = await useDb().select({ testId: attempts.testId, skill: attempts.skill, part: attempts.partNumber }).from(attempts)
    .where(and(eq(attempts.userId, userId), inArray(attempts.testId, [...new Set(withTask.map(l => l.taskTestId!))])))
  return new Set(withTask.filter(l => rows.some(r => r.testId === l.taskTestId && r.skill === l.taskSkill && (r.part ?? null) === (l.taskPartNumber ?? null))).map(l => l.id))
}

export const taskPath = (slug: string, l: Pick<Lesson, 'taskSkill' | 'taskPartNumber'>) => `/tests/${slug}/${l.taskSkill!.toLowerCase()}${l.taskPartNumber ? `?part=${l.taskPartNumber}` : ''}`

/** A course for its catalogue card. */
async function cards(rows: Course[]) {
  if (!rows.length) return []
  const db = useDb()
  const ids = rows.map(r => r.id)
  const [teachers, lessonCounts, learners] = await Promise.all([
    db.select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, [...new Set(rows.map(r => r.teacherId))])),
    db.select({ id: courseLessons.courseId, n: count() }).from(courseLessons).where(inArray(courseLessons.courseId, ids)).groupBy(courseLessons.courseId),
    db.select({ id: courseEnrollments.courseId, n: count() }).from(courseEnrollments).where(inArray(courseEnrollments.courseId, ids)).groupBy(courseEnrollments.courseId)
  ])
  return rows.map((c) => {
    const t = teachers.find(x => x.id === c.teacherId)
    return {
      id: c.id, slug: c.slug, title: c.title, summary: c.summary, exam: c.exam, level: c.level, visibility: c.visibility, published: c.published,
      teacher: t ? { name: nameOf(t), avatarUrl: t.avatarUrl } : null,
      lessons: lessonCounts.find(x => x.id === c.id)?.n ?? 0,
      learners: learners.find(x => x.id === c.id)?.n ?? 0,
      updatedAt: c.updatedAt
    }
  })
}

/** The catalogue: published public courses, newest first (?exam=). */
export async function publicCourses(exam?: string) {
  const rows = await useDb().select().from(courses)
    .where(and(eq(courses.visibility, 'PUBLIC'), eq(courses.published, true), isExam(exam) ? eq(courses.exam, exam) : undefined))
    .orderBy(desc(courses.updatedAt)).limit(200)
  return cards(rows)
}

/** A teacher's own courses, for their list. */
export async function teacherCourses(teacherId: string) {
  return cards(await useDb().select().from(courses).where(eq(courses.teacherId, teacherId)).orderBy(desc(courses.updatedAt)))
}

/** The courses a student takes: public ones enrolled in, and their teachers' private ones; with how far they are. */
export async function learnerCourses(userId: string) {
  const db = useDb()
  const teachers = (await db.selectDistinct({ id: classGroups.teacherId }).from(classMembers).innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classMembers.userId, userId), eq(classGroups.archived, false)))).map(r => r.id).filter(id => id !== userId)
  const enrolled = (await db.select({ id: courseEnrollments.courseId }).from(courseEnrollments).where(eq(courseEnrollments.userId, userId))).map(r => r.id)
  const rows = await db.select().from(courses).where(and(eq(courses.published, true), sql`(
    (${courses.visibility} = 'PUBLIC' and ${enrolled.length ? inArray(courses.id, enrolled) : sql`false`})
    or (${courses.visibility} = 'PRIVATE' and ${teachers.length ? inArray(courses.teacherId, teachers) : sql`false`})
  )`)).orderBy(desc(courses.updatedAt))
  const list = await cards(rows)
  if (!list.length) return []
  const done = await db.select({ courseId: courseLessons.courseId, n: count() }).from(lessonProgress)
    .innerJoin(courseLessons, eq(courseLessons.id, lessonProgress.lessonId))
    .where(and(eq(lessonProgress.userId, userId), inArray(courseLessons.courseId, list.map(c => c.id)))).groupBy(courseLessons.courseId)
  return list.map(c => ({ ...c, done: done.find(d => d.courseId === c.id)?.n ?? 0 }))
}

/** A course's page: its lessons (what each holds, and whether the viewer did it), and what the viewer may do. */
export async function courseView(viewer: Viewer, course: Course) {
  const access = await accessTo(viewer, course)
  if (!access.see) throw createError({ statusCode: 404, message: 'Course not found' })
  const db = useDb()
  const lessons = await db.select().from(courseLessons).where(eq(courseLessons.courseId, course.id)).orderBy(asc(courseLessons.position))
  const [card] = await cards([course])
  const doneIds = viewer && access.learn
    ? new Set((await db.select({ id: lessonProgress.lessonId }).from(lessonProgress)
        .where(and(eq(lessonProgress.userId, viewer.id), lessons.length ? inArray(lessonProgress.lessonId, lessons.map(l => l.id)) : sql`false`))).map(r => r.id))
    : new Set<string>()
  const handedIn = viewer && access.learn ? await tasksDone(viewer.id, lessons) : new Set<string>()
  return {
    ...card!,
    access,
    lessons: lessons.map(l => ({ id: l.id, position: l.position, title: l.title, has: what(l), done: doneIds.has(l.id), taskDone: handedIn.has(l.id) }))
  }
}

/** A lesson for a learner (or the teacher): its content, the course's order around it, and their progress. */
export async function lessonView(viewer: Viewer, lesson: Lesson) {
  const course = await findCourse(lesson.courseId)
  const access = await accessTo(viewer, course)
  if (!access.see) throw createError({ statusCode: 404, message: 'Lesson not found' })
  if (!access.learn) throw createError({ statusCode: 403, message: course.visibility === 'PUBLIC' ? 'Enroll in the course to open its lessons' : 'This course is for the teacher\'s students', data: { code: 'ENROLL', slug: course.slug } })
  const db = useDb()
  const order = await db.select({ id: courseLessons.id, title: courseLessons.title }).from(courseLessons).where(eq(courseLessons.courseId, course.id)).orderBy(asc(courseLessons.position))
  const at = order.findIndex(o => o.id === lesson.id)
  const [test] = lesson.taskTestId ? await db.select({ slug: tests.slug, title: tests.title }).from(tests).where(eq(tests.id, lesson.taskTestId)).limit(1) : []
  const [live] = lesson.liveLessonId ? await db.select().from(liveLessons).where(eq(liveLessons.id, lesson.liveLessonId)).limit(1) : []
  const [done] = viewer ? await db.select({ one: sql<number>`1` }).from(lessonProgress).where(and(eq(lessonProgress.lessonId, lesson.id), eq(lessonProgress.userId, viewer.id))).limit(1) : []
  const taskDone = viewer ? (await tasksDone(viewer.id, [lesson])).has(lesson.id) : false
  return {
    id: lesson.id, title: lesson.title, body: lesson.body, videoUrl: lesson.videoUrl, files: lesson.files,
    task: test && lesson.taskSkill ? { test: test.title, skill: lesson.taskSkill, partNumber: lesson.taskPartNumber, to: taskPath(test.slug, lesson), done: taskDone } : null,
    live: live ? liveView(live, true) : null,
    done: !!done,
    course: { id: course.id, slug: course.slug, title: course.title, teaches: access.teaches },
    position: at + 1, of: order.length,
    prev: at > 0 ? order[at - 1] : null,
    next: at >= 0 && at < order.length - 1 ? order[at + 1] : null
  }
}

/** For the teacher: every lesson in full, and each learner's progress. */
export async function manageView(course: Course) {
  const db = useDb()
  const lessons = await db.select().from(courseLessons).where(eq(courseLessons.courseId, course.id)).orderBy(asc(courseLessons.position))
  const testIds = [...new Set(lessons.map(l => l.taskTestId).filter((x): x is string => !!x))]
  const liveIds = lessons.map(l => l.liveLessonId).filter((x): x is string => !!x)
  const [testRows, liveRows, learnerIds] = await Promise.all([
    testIds.length ? db.select({ id: tests.id, slug: tests.slug, title: tests.title }).from(tests).where(inArray(tests.id, testIds)) : [],
    liveIds.length ? db.select().from(liveLessons).where(inArray(liveLessons.id, liveIds)) : [],
    courseAudience(course)
  ])
  const learners = learnerIds.length
    ? await db.select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, learnerIds))
    : []
  const progress = learnerIds.length && lessons.length
    ? await db.select({ userId: lessonProgress.userId, n: count() }).from(lessonProgress)
        .where(and(inArray(lessonProgress.userId, learnerIds), inArray(lessonProgress.lessonId, lessons.map(l => l.id)))).groupBy(lessonProgress.userId)
    : []
  const tasks = lessons.filter(l => l.taskTestId).length
  const taskCounts = await Promise.all(learners.map(async u => [u.id, (await tasksDone(u.id, lessons)).size] as const))
  const [card] = await cards([course])
  return {
    ...card!,
    lessons: lessons.map((l) => {
      const t = testRows.find(x => x.id === l.taskTestId)
      const live = liveRows.find(x => x.id === l.liveLessonId)
      return {
        id: l.id, position: l.position, title: l.title, body: l.body, videoUrl: l.videoUrl, files: l.files,
        task: l.taskTestId ? { testId: l.taskTestId, test: t?.title ?? null, skill: l.taskSkill, partNumber: l.taskPartNumber } : null,
        live: live ? liveView(live, true) : null
      }
    }),
    tasks,
    learners: learners.map(u => ({
      id: u.id, name: nameOf(u), avatarUrl: u.avatarUrl,
      done: progress.find(p => p.userId === u.id)?.n ?? 0,
      tasksDone: taskCounts.find(([id]) => id === u.id)?.[1] ?? 0
    })).sort((a, b) => b.done - a.done || a.name.localeCompare(b.name))
  }
}

/** The public courses' pages, for the sitemap. */
export async function publicCourseUrls() {
  const rows = await useDb().select({ slug: courses.slug, updatedAt: courses.updatedAt }).from(courses)
    .where(and(eq(courses.visibility, 'PUBLIC'), eq(courses.published, true)))
  return rows
}
