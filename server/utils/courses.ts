import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  attempts,
  classGroups,
  classMembers,
  courseEnrollments,
  courseLessons,
  courseModules,
  courses,
  exerciseAttempts,
  exerciseQuestions,
  lessonExercises,
  lessonProgress,
  liveLessons,
  tests,
  users
} from '../database/schema'

/**
 * LMS Courses: Course => Units/Modules => Lessons => Exercises => Questions (12 types),
 * plus videos, rich text, PDFs, exam tasks, Google Meet live classes, and Content Drip
 * (ALWAYS_OPEN, DATE_RANGE from-to, SEQUENTIAL one-after-another).
 */

type Course = typeof courses.$inferSelect
type ModuleRow = typeof courseModules.$inferSelect
type Lesson = typeof courseLessons.$inferSelect
type Viewer = { id: string, role: string } | null

export const VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const
const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

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
  /** May see the course's page (its modules and lessons' titles). */
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

export async function findModule(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Module not found' })
  const [m] = await useDb().select().from(courseModules).where(eq(courseModules.id, id)).limit(1)
  if (!m) throw createError({ statusCode: 404, message: 'Module not found' })
  return m
}

export async function requireModuleTeacher(event: H3Event, moduleId: string) {
  const mod = await findModule(moduleId)
  const { user, course } = await requireCourseTeacher(event, mod.courseId)
  return { user, course, module: mod }
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
/** A short list for the course's page (what learners will learn, need, are): up to 20 lines. */
const list = (v: unknown) => (Array.isArray(v) ? v : []).map(x => text(x, 200)).filter(Boolean).slice(0, 20)

function optionalDate(v: unknown, label = 'date'): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw createError({ statusCode: 400, message: `Invalid ${label}` })
  return d
}

/** The course's fields as the editor sends them; only those given are kept. */
export function courseValues(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<typeof courses.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = text(body.title, 120)
    if (!title) throw createError({ statusCode: 400, message: 'Give the course a title' })
    out.title = title
  }
  if (body.summary !== undefined) out.summary = text(body.summary, 400) || null
  if (body.coverUrl !== undefined) out.coverUrl = link(body.coverUrl)
  if (body.description !== undefined) out.description = sanitizeRichText(String(body.description ?? '')).slice(0, 50_000) || null
  if (body.introVideoUrl !== undefined) out.introVideoUrl = link(body.introVideoUrl)
  if (body.outcomes !== undefined) out.outcomes = list(body.outcomes)
  if (body.requirements !== undefined) out.requirements = list(body.requirements)
  if (body.audience !== undefined) out.audience = list(body.audience)
  if (body.exam !== undefined) out.exam = isExam(body.exam) ? body.exam : null
  if (body.level !== undefined) out.level = LEVELS.includes(String(body.level)) ? String(body.level) : null
  if (body.visibility !== undefined) {
    if (!VISIBILITIES.includes(body.visibility as never)) throw createError({ statusCode: 400, message: 'Private or public?' })
    out.visibility = String(body.visibility)
  }
  if (body.published !== undefined) out.published = !!body.published
  if (body.dripMode !== undefined) {
    if (!isDripMode(body.dripMode)) throw createError({ statusCode: 400, message: 'Invalid content drip mode' })
    out.dripMode = body.dripMode
  }
  if (body.dripStartAt !== undefined) out.dripStartAt = optionalDate(body.dripStartAt, 'start date')
  if (body.dripEndAt !== undefined) out.dripEndAt = optionalDate(body.dripEndAt, 'end date')
  if (out.dripStartAt && out.dripEndAt && out.dripEndAt <= out.dripStartAt) {
    throw createError({ statusCode: 400, message: 'End date must be after start date' })
  }
  if (body.passingScore !== undefined) {
    const n = Math.round(Number(body.passingScore))
    if (!Number.isFinite(n) || n < 0 || n > 100) throw createError({ statusCode: 400, message: 'Passing score must be between 0 and 100' })
    out.passingScore = n
  }
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
    // Seed a starter Unit 1 so the LMS hierarchy is ready immediately.
    await tx.insert(courseModules).values({ courseId: c!.id, position: 1, title: 'Unit 1: Getting Started' })
    return c!
  })
}

/** A module's fields as the editor sends them. */
export function moduleValues(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<typeof courseModules.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = text(body.title, 160)
    if (!title) throw createError({ statusCode: 400, message: 'Give the unit/module a title' })
    out.title = title
  }
  if (body.description !== undefined) out.description = text(body.description, 500) || null
  if (body.dripMode !== undefined) {
    if (body.dripMode === null || body.dripMode === '' || body.dripMode === 'INHERIT') out.dripMode = null
    else if (isDripMode(body.dripMode)) out.dripMode = body.dripMode
    else throw createError({ statusCode: 400, message: 'Invalid drip mode' })
  }
  if (body.availableFrom !== undefined) out.availableFrom = optionalDate(body.availableFrom, 'available from date')
  if (body.availableTo !== undefined) out.availableTo = optionalDate(body.availableTo, 'available to date')
  if (out.availableFrom && out.availableTo && out.availableTo <= out.availableFrom) {
    throw createError({ statusCode: 400, message: 'Available-to date must be after available-from date' })
  }
  return out
}

export async function addModule(course: Course, body: Record<string, unknown>) {
  const v = moduleValues(body, false)
  const db = useDb()
  const [last] = await db.select({ n: sql<number>`coalesce(max(${courseModules.position}), 0)::int` }).from(courseModules).where(eq(courseModules.courseId, course.id))
  const [m] = await db.insert(courseModules).values({ ...v, title: v.title!, courseId: course.id, position: (last?.n ?? 0) + 1 }).returning()
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return m!
}

export async function reorderModules(course: Course, ids: string[]) {
  const db = useDb()
  const mine = (await db.select({ id: courseModules.id }).from(courseModules).where(eq(courseModules.courseId, course.id))).map(r => r.id)
  if (ids.length !== mine.length || ids.some(id => !mine.includes(id))) throw createError({ statusCode: 400, message: 'Give every unit/module of the course, in order' })
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(courseModules).set({ position: i + 1 }).where(eq(courseModules.id, id))
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
export async function lessonValues(body: Record<string, unknown>, partial: boolean, courseId?: string) {
  const out: Partial<typeof courseLessons.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = text(body.title, 160)
    if (!title) throw createError({ statusCode: 400, message: 'Give the lesson a title' })
    out.title = title
  }
  if (body.summary !== undefined) out.summary = text(body.summary, 400) || null
  if (body.durationMinutes !== undefined) {
    const d = body.durationMinutes === null || body.durationMinutes === '' ? null : Math.round(Number(body.durationMinutes))
    out.durationMinutes = d && Number.isFinite(d) && d > 0 ? Math.min(600, d) : null
  }
  if (body.moduleId !== undefined) {
    const mid = body.moduleId ? String(body.moduleId) : null
    if (mid) {
      if (!/^[0-9a-f-]{36}$/i.test(mid)) throw createError({ statusCode: 400, message: 'Invalid unit/module' })
      if (courseId) {
        const [mod] = await useDb().select({ id: courseModules.id }).from(courseModules).where(and(eq(courseModules.id, mid), eq(courseModules.courseId, courseId))).limit(1)
        if (!mod) throw createError({ statusCode: 400, message: 'Unit/module does not belong to this course' })
      }
      out.moduleId = mid
    } else {
      out.moduleId = null
    }
  }
  if (body.availableFrom !== undefined) out.availableFrom = optionalDate(body.availableFrom, 'available from date')
  if (body.availableTo !== undefined) out.availableTo = optionalDate(body.availableTo, 'available to date')
  if (out.availableFrom && out.availableTo && out.availableTo <= out.availableFrom) {
    throw createError({ statusCode: 400, message: 'Available-to date must be after available-from date' })
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
  const v = await lessonValues(body, false, course.id)
  const db = useDb()
  const [last] = await db.select({ n: sql<number>`coalesce(max(${courseLessons.position}), 0)::int` }).from(courseLessons).where(eq(courseLessons.courseId, course.id))
  const [l] = await db.insert(courseLessons).values({ ...v, title: v.title!, courseId: course.id, position: (last?.n ?? 0) + 1 }).returning()
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return l!
}

/** Puts the lessons in the order given (ids of this course's lessons, or a module's lessons). */
export async function reorderLessons(course: Course, ids: string[], moduleId?: string | null) {
  const db = useDb()
  const mine = (await db.select({ id: courseLessons.id, moduleId: courseLessons.moduleId }).from(courseLessons).where(eq(courseLessons.courseId, course.id)))
  const scoped = moduleId === undefined ? mine.map(r => r.id) : mine.filter(r => (r.moduleId ?? null) === (moduleId ?? null)).map(r => r.id)
  if (ids.length !== scoped.length || ids.some(id => !scoped.includes(id))) throw createError({ statusCode: 400, message: 'Give every lesson in order' })
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(courseLessons).set({ position: i + 1 }).where(eq(courseLessons.id, id))
  })
}

// ---------- reading & ordering ----------

/** Returns modules and lessons ordered canonically: module.position asc, then lesson.position asc; ungrouped lessons last. */
export async function loadOrderedCurriculum(courseId: string) {
  const db = useDb()
  const [mods, rawLessons] = await Promise.all([
    db.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.position), asc(courseModules.createdAt)),
    db.select().from(courseLessons).where(eq(courseLessons.courseId, courseId)).orderBy(asc(courseLessons.position), asc(courseLessons.createdAt))
  ])
  const modOrder = new Map(mods.map((m, idx) => [m.id, idx]))
  const lessons = [...rawLessons].sort((a, b) => {
    const ma = a.moduleId && modOrder.has(a.moduleId) ? modOrder.get(a.moduleId)! : Number.MAX_SAFE_INTEGER
    const mb = b.moduleId && modOrder.has(b.moduleId) ? modOrder.get(b.moduleId)! : Number.MAX_SAFE_INTEGER
    if (ma !== mb) return ma - mb
    return a.position - b.position
  })
  return { modules: mods, lessons }
}

/** Compute content-drip state for every lesson in canonical order. */
export function evaluateCourseDrip(course: Course, mods: ModuleRow[], orderedLessons: Lesson[], doneIds: Set<string>, bypass: boolean) {
  const modMap = new Map(mods.map(m => [m.id, m]))
  const map = new Map<string, DripState>()
  const now = new Date()
  for (let i = 0; i < orderedLessons.length; i++) {
    const l = orderedLessons[i]!
    const mod = l.moduleId ? modMap.get(l.moduleId) : undefined
    const prev = i > 0 ? orderedLessons[i - 1]! : null
    const state = computeDripState({
      courseDripMode: course.dripMode,
      courseStartAt: course.dripStartAt,
      courseEndAt: course.dripEndAt,
      moduleDripMode: mod?.dripMode ?? null,
      moduleFrom: mod?.availableFrom ?? null,
      moduleTo: mod?.availableTo ?? null,
      lessonFrom: l.availableFrom,
      lessonTo: l.availableTo,
      prevLesson: prev ? { id: prev.id, title: prev.title, done: doneIds.has(prev.id) } : null,
      now
    })
    map.set(l.id, bypass ? { ...state, locked: false, reason: null } : state)
  }
  return map
}

const what = (l: Lesson, exerciseCount = 0) => ({
  text: !!l.body,
  video: !!l.videoUrl,
  task: !!l.taskTestId,
  files: Array.isArray(l.files) && l.files.length > 0,
  live: !!l.liveLessonId,
  exercises: exerciseCount > 0
})

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
  const [teachers, moduleCounts, lessonCounts, learners] = await Promise.all([
    db.select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, [...new Set(rows.map(r => r.teacherId))])),
    db.select({ id: courseModules.courseId, n: count() }).from(courseModules).where(inArray(courseModules.courseId, ids)).groupBy(courseModules.courseId),
    db.select({ id: courseLessons.courseId, n: count() }).from(courseLessons).where(inArray(courseLessons.courseId, ids)).groupBy(courseLessons.courseId),
    db.select({ id: courseEnrollments.courseId, n: count() }).from(courseEnrollments).where(inArray(courseEnrollments.courseId, ids)).groupBy(courseEnrollments.courseId)
  ])
  return rows.map((c) => {
    const t = teachers.find(x => x.id === c.teacherId)
    return {
      id: c.id, slug: c.slug, title: c.title, summary: c.summary, coverUrl: c.coverUrl, exam: c.exam, level: c.level,
      visibility: c.visibility, published: c.published,
      dripMode: c.dripMode as DripMode, dripStartAt: c.dripStartAt, dripEndAt: c.dripEndAt, passingScore: c.passingScore,
      teacher: t ? { name: nameOf(t), avatarUrl: t.avatarUrl } : null,
      modules: moduleCounts.find(x => x.id === c.id)?.n ?? 0,
      lessons: lessonCounts.find(x => x.id === c.id)?.n ?? 0,
      learners: learners.find(x => x.id === c.id)?.n ?? 0,
      updatedAt: c.updatedAt
    }
  })
}

/** What a course's page says beyond its card. */
const pageOf = (c: Course) => ({
  description: c.description, introVideoUrl: c.introVideoUrl, outcomes: c.outcomes ?? [], requirements: c.requirements ?? [], audience: c.audience ?? []
})

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

/** A course's page: its units/modules, lessons (with content drip state and exercise counts), and viewer access. */
export async function courseView(viewer: Viewer, course: Course) {
  const access = await accessTo(viewer, course)
  if (!access.see) throw createError({ statusCode: 404, message: 'Course not found' })
  const db = useDb()
  const { modules: mods, lessons } = await loadOrderedCurriculum(course.id)
  const [card] = await cards([course])
  const lessonIds = lessons.map(l => l.id)
  const [doneRows, exerciseCounts, handedIn] = await Promise.all([
    viewer && access.learn && lessonIds.length
      ? db.select({ id: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, viewer.id), inArray(lessonProgress.lessonId, lessonIds)))
      : [],
    lessonIds.length
      ? db.select({ lessonId: lessonExercises.lessonId, n: count() }).from(lessonExercises).where(inArray(lessonExercises.lessonId, lessonIds)).groupBy(lessonExercises.lessonId)
      : [],
    viewer && access.learn ? tasksDone(viewer.id, lessons) : Promise.resolve(new Set<string>())
  ])
  const doneIds = new Set(doneRows.map(r => r.id))
  const exCountMap = new Map(exerciseCounts.map(r => [r.lessonId, r.n]))
  const dripMap = evaluateCourseDrip(course, mods, lessons, doneIds, access.teaches)

  const lessonItems = lessons.map((l, idx) => {
    const exerciseCount = exCountMap.get(l.id) ?? 0
    return {
      id: l.id,
      moduleId: l.moduleId,
      position: idx + 1,
      title: l.title,
      summary: l.summary,
      durationMinutes: l.durationMinutes,
      exerciseCount,
      has: what(l, exerciseCount),
      done: doneIds.has(l.id),
      taskDone: handedIn.has(l.id),
      drip: dripMap.get(l.id)!
    }
  })

  const moduleList = mods.map(m => ({
    id: m.id,
    position: m.position,
    title: m.title,
    description: m.description,
    dripMode: m.dripMode,
    availableFrom: m.availableFrom,
    availableTo: m.availableTo,
    lessons: lessonItems.filter(l => l.moduleId === m.id)
  }))
  const ungrouped = lessonItems.filter(l => !l.moduleId || !mods.some(m => m.id === l.moduleId))
  if (ungrouped.length) {
    moduleList.push({
      id: '__ungrouped__',
      position: moduleList.length + 1,
      title: moduleList.length ? 'Additional Lessons' : 'Course Lessons',
      description: null,
      dripMode: null,
      availableFrom: null,
      availableTo: null,
      lessons: ungrouped
    })
  }

  return {
    ...card!,
    ...pageOf(course),
    access,
    totalMinutes: lessons.reduce((n, l) => n + (l.durationMinutes ?? 0), 0),
    exerciseTotal: [...exCountMap.values()].reduce((n, x) => n + x, 0),
    modules: moduleList,
    lessons: lessonItems
  }
}

/** A lesson for a learner (or the teacher): enforces content drip, includes exercises and full outline. */
export async function lessonView(viewer: Viewer, lesson: Lesson) {
  const course = await findCourse(lesson.courseId)
  const access = await accessTo(viewer, course)
  if (!access.see) throw createError({ statusCode: 404, message: 'Lesson not found' })
  if (!access.learn) throw createError({ statusCode: 403, message: course.visibility === 'PUBLIC' ? 'Enroll in the course to open its lessons' : 'This course is for the teacher\'s students', data: { code: 'ENROLL', slug: course.slug } })

  const db = useDb()
  const { modules: mods, lessons } = await loadOrderedCurriculum(course.id)
  const lessonIds = lessons.map(l => l.id)
  const doneRows = viewer && lessonIds.length
    ? await db.select({ id: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, viewer.id), inArray(lessonProgress.lessonId, lessonIds)))
    : []
  const doneIds = new Set(doneRows.map(r => r.id))
  const dripMap = evaluateCourseDrip(course, mods, lessons, doneIds, access.teaches)
  const drip = dripMap.get(lesson.id)!

  if (drip.locked && !access.teaches) {
    throw createError({
      statusCode: 403,
      message: drip.reason === 'PREVIOUS_INCOMPLETE'
        ? `Complete "${drip.previousLessonTitle || 'the previous lesson'}" first to unlock this lesson.`
        : drip.reason === 'DATE_EXPIRED'
          ? 'This lesson is no longer available.'
          : 'This lesson is not open yet.',
      data: { code: 'DRIP_LOCKED', drip, slug: course.slug }
    })
  }

  const at = lessons.findIndex(o => o.id === lesson.id)
  const mod = lesson.moduleId ? mods.find(m => m.id === lesson.moduleId) : null
  const [testRow, liveRow, exRows, taskDoneSet] = await Promise.all([
    lesson.taskTestId ? db.select({ slug: tests.slug, title: tests.title }).from(tests).where(eq(tests.id, lesson.taskTestId)).limit(1) : Promise.resolve([]),
    lesson.liveLessonId ? db.select().from(liveLessons).where(eq(liveLessons.id, lesson.liveLessonId)).limit(1) : Promise.resolve([]),
    db.select().from(lessonExercises).where(eq(lessonExercises.lessonId, lesson.id)).orderBy(asc(lessonExercises.position), asc(lessonExercises.createdAt)),
    viewer ? tasksDone(viewer.id, [lesson]) : Promise.resolve(new Set<string>())
  ])
  const test = testRow[0]
  const live = liveRow[0]

  const exIds = exRows.map(e => e.id)
  const [qCounts, myExAttempts] = await Promise.all([
    exIds.length ? db.select({ exerciseId: exerciseQuestions.exerciseId, n: count() }).from(exerciseQuestions).where(inArray(exerciseQuestions.exerciseId, exIds)).groupBy(exerciseQuestions.exerciseId) : [],
    viewer && exIds.length ? db.select().from(exerciseAttempts).where(and(eq(exerciseAttempts.userId, viewer.id), inArray(exerciseAttempts.exerciseId, exIds))).orderBy(desc(exerciseAttempts.submittedAt)) : []
  ])

  const exercises = exRows.map((e) => {
    const mine = myExAttempts.filter(a => a.exerciseId === e.id)
    const best = mine.reduce<number | null>((acc, a) => (acc == null ? a.score : Math.max(acc, a.score)), null)
    const passed = mine.some(a => a.passed)
    return {
      id: e.id,
      position: e.position,
      title: e.title,
      instructions: e.instructions,
      exerciseType: e.exerciseType,
      passingScore: e.passingScore,
      timeLimitSeconds: e.timeLimitSeconds,
      maxAttempts: e.maxAttempts,
      shuffleQuestions: e.shuffleQuestions,
      showFeedback: e.showFeedback,
      requiredForCompletion: e.requiredForCompletion,
      questionCount: qCounts.find(q => q.exerciseId === e.id)?.n ?? 0,
      attemptsUsed: mine.length,
      bestScore: best,
      passed,
      lastAttemptId: mine[0]?.id ?? null
    }
  })

  const requiredPending = exercises.filter(e => e.requiredForCompletion && !e.passed).length
  const outlineModules = mods.map(m => ({
    id: m.id,
    title: m.title,
    lessons: lessons.filter(l => l.moduleId === m.id).map(l => ({
      id: l.id,
      title: l.title,
      done: doneIds.has(l.id),
      locked: dripMap.get(l.id)?.locked ?? false
    }))
  }))
  const ungroupedOutline = lessons.filter(l => !l.moduleId || !mods.some(m => m.id === l.moduleId))
  if (ungroupedOutline.length) {
    outlineModules.push({
      id: '__ungrouped__',
      title: outlineModules.length ? 'Additional Lessons' : 'Lessons',
      lessons: ungroupedOutline.map(l => ({
        id: l.id,
        title: l.title,
        done: doneIds.has(l.id),
        locked: dripMap.get(l.id)?.locked ?? false
      }))
    })
  }

  const prevL = at > 0 ? lessons[at - 1]! : null
  const nextL = at >= 0 && at < lessons.length - 1 ? lessons[at + 1]! : null

  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    module: mod ? { id: mod.id, title: mod.title, position: mod.position } : null,
    title: lesson.title,
    summary: lesson.summary,
    durationMinutes: lesson.durationMinutes,
    body: lesson.body,
    videoUrl: lesson.videoUrl,
    files: lesson.files,
    task: test && lesson.taskSkill ? { test: test.title, skill: lesson.taskSkill, partNumber: lesson.taskPartNumber, to: taskPath(test.slug, lesson), done: taskDoneSet.has(lesson.id) } : null,
    live: live ? liveView(live, true) : null,
    exercises,
    canMarkDone: requiredPending === 0,
    requiredPending,
    drip,
    done: doneIds.has(lesson.id),
    course: { id: course.id, slug: course.slug, title: course.title, teaches: access.teaches, dripMode: course.dripMode },
    outline: outlineModules,
    position: at + 1,
    of: lessons.length,
    prev: prevL ? { id: prevL.id, title: prevL.title } : null,
    next: nextL ? { id: nextL.id, title: nextL.title, locked: dripMap.get(nextL.id)?.locked ?? false } : null
  }
}

/** For the teacher/admin: full curriculum (modules -> lessons -> exercises) and each learner's progress. */
export async function manageView(course: Course) {
  const db = useDb()
  const { modules: mods, lessons } = await loadOrderedCurriculum(course.id)
  const lessonIds = lessons.map(l => l.id)
  const testIds = [...new Set(lessons.map(l => l.taskTestId).filter((x): x is string => !!x))]
  const liveIds = lessons.map(l => l.liveLessonId).filter((x): x is string => !!x)

  const [testRows, liveRows, exRows, learnerIds] = await Promise.all([
    testIds.length ? db.select({ id: tests.id, slug: tests.slug, title: tests.title }).from(tests).where(inArray(tests.id, testIds)) : [],
    liveIds.length ? db.select().from(liveLessons).where(inArray(liveLessons.id, liveIds)) : [],
    lessonIds.length ? db.select().from(lessonExercises).where(inArray(lessonExercises.lessonId, lessonIds)).orderBy(asc(lessonExercises.position), asc(lessonExercises.createdAt)) : [],
    courseAudience(course)
  ])

  const exIds = exRows.map(e => e.id)
  const [qCounts, learners, progress, exAttempts] = await Promise.all([
    exIds.length ? db.select({ exerciseId: exerciseQuestions.exerciseId, n: count() }).from(exerciseQuestions).where(inArray(exerciseQuestions.exerciseId, exIds)).groupBy(exerciseQuestions.exerciseId) : [],
    learnerIds.length ? db.select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, learnerIds)) : [],
    learnerIds.length && lessonIds.length
      ? db.select({ userId: lessonProgress.userId, n: count() }).from(lessonProgress)
          .where(and(inArray(lessonProgress.userId, learnerIds), inArray(lessonProgress.lessonId, lessonIds))).groupBy(lessonProgress.userId)
      : [],
    learnerIds.length && exIds.length
      ? db.select({ userId: exerciseAttempts.userId, exerciseId: exerciseAttempts.exerciseId, score: exerciseAttempts.score, passed: exerciseAttempts.passed }).from(exerciseAttempts)
          .where(and(inArray(exerciseAttempts.userId, learnerIds), inArray(exerciseAttempts.exerciseId, exIds)))
      : []
  ])

  const tasks = lessons.filter(l => l.taskTestId).length
  const taskCounts = await Promise.all(learners.map(async u => [u.id, (await tasksDone(u.id, lessons)).size] as const))
  const [card] = await cards([course])

  const lessonList = lessons.map((l) => {
    const t = testRows.find(x => x.id === l.taskTestId)
    const live = liveRows.find(x => x.id === l.liveLessonId)
    const exercises = exRows.filter(e => e.lessonId === l.id).map(e => ({
      id: e.id,
      lessonId: e.lessonId,
      position: e.position,
      title: e.title,
      instructions: e.instructions,
      exerciseType: e.exerciseType,
      passingScore: e.passingScore,
      timeLimitSeconds: e.timeLimitSeconds,
      maxAttempts: e.maxAttempts,
      shuffleQuestions: e.shuffleQuestions,
      showFeedback: e.showFeedback,
      requiredForCompletion: e.requiredForCompletion,
      questionCount: qCounts.find(q => q.exerciseId === e.id)?.n ?? 0
    }))
    return {
      id: l.id,
      moduleId: l.moduleId,
      position: l.position,
      title: l.title,
      summary: l.summary,
      durationMinutes: l.durationMinutes,
      body: l.body,
      videoUrl: l.videoUrl,
      files: l.files,
      availableFrom: l.availableFrom,
      availableTo: l.availableTo,
      task: l.taskTestId ? { testId: l.taskTestId, test: t?.title ?? null, skill: l.taskSkill, partNumber: l.taskPartNumber } : null,
      live: live ? liveView(live, true) : null,
      exercises
    }
  })

  return {
    ...card!,
    ...pageOf(course),
    modules: mods.map(m => ({
      id: m.id,
      position: m.position,
      title: m.title,
      description: m.description,
      dripMode: m.dripMode,
      availableFrom: m.availableFrom,
      availableTo: m.availableTo
    })),
    lessons: lessonList,
    tasks,
    exerciseTotal: exRows.length,
    learners: learners.map((u) => {
      const mineEx = exAttempts.filter(a => a.userId === u.id)
      const passedExercises = new Set(mineEx.filter(a => a.passed).map(a => a.exerciseId)).size
      const avgScore = mineEx.length ? Math.round(mineEx.reduce((s, a) => s + a.score, 0) / mineEx.length) : null
      return {
        id: u.id,
        name: nameOf(u),
        avatarUrl: u.avatarUrl,
        done: progress.find(p => p.userId === u.id)?.n ?? 0,
        tasksDone: taskCounts.find(([id]) => id === u.id)?.[1] ?? 0,
        exercisesPassed: passedExercises,
        avgExerciseScore: avgScore
      }
    }).sort((a, b) => b.done - a.done || a.name.localeCompare(b.name))
  }
}

/** The public courses' pages, for the sitemap. */
export async function publicCourseUrls() {
  const rows = await useDb().select({ slug: courses.slug, updatedAt: courses.updatedAt }).from(courses)
    .where(and(eq(courses.visibility, 'PUBLIC'), eq(courses.published, true)))
  return rows
}
