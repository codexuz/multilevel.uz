import type { H3Event } from 'h3'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  courseLessons,
  courses,
  exerciseAttempts,
  exerciseQuestions,
  lessonExercises,
  lessonProgress
} from '../database/schema'
import type { LmsQuestionGrade } from '../../shared/utils/lms'

type Exercise = typeof lessonExercises.$inferSelect
type Question = typeof exerciseQuestions.$inferSelect
type Viewer = { id: string, role: string }

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export async function findExercise(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Exercise not found' })
  const [ex] = await useDb().select().from(lessonExercises).where(eq(lessonExercises.id, id)).limit(1)
  if (!ex) throw createError({ statusCode: 404, message: 'Exercise not found' })
  return ex
}

export async function requireExerciseTeacher(event: H3Event, exerciseId: string) {
  const exercise = await findExercise(exerciseId)
  const { user, course, lesson } = await requireLessonTeacher(event, exercise.lessonId)
  return { user, course, lesson, exercise }
}

/** An exercise attempt, or 404. */
export async function findExerciseAttempt(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Attempt not found' })
  const [row] = await useDb().select().from(exerciseAttempts).where(eq(exerciseAttempts.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Attempt not found' })
  return row
}

export async function findQuestion(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'Question not found' })
  const [q] = await useDb().select().from(exerciseQuestions).where(eq(exerciseQuestions.id, id)).limit(1)
  if (!q) throw createError({ statusCode: 404, message: 'Question not found' })
  return q
}

export async function requireQuestionTeacher(event: H3Event, questionId: string) {
  const question = await findQuestion(questionId)
  const ctx = await requireExerciseTeacher(event, question.exerciseId)
  return { ...ctx, question }
}

export function exerciseValues(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<typeof lessonExercises.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = text(body.title, 160)
    if (!title) throw createError({ statusCode: 400, message: 'Give the exercise a title' })
    out.title = title
  }
  if (body.instructions !== undefined) out.instructions = text(body.instructions, 2000) || null
  if (body.exerciseType !== undefined) {
    const et = String(body.exerciseType).toUpperCase()
    if (!['PRACTICE', 'QUIZ', 'HOMEWORK'].includes(et)) throw createError({ statusCode: 400, message: 'Invalid exercise type' })
    out.exerciseType = et
  }
  if (body.passingScore !== undefined) {
    const p = Math.round(Number(body.passingScore))
    if (!Number.isFinite(p) || p < 0 || p > 100) throw createError({ statusCode: 400, message: 'Passing score must be 0–100' })
    out.passingScore = p
  }
  if (body.timeLimitSeconds !== undefined) {
    const s = body.timeLimitSeconds === null || body.timeLimitSeconds === '' ? null : Math.round(Number(body.timeLimitSeconds))
    out.timeLimitSeconds = s && Number.isFinite(s) && s > 0 ? Math.min(14400, s) : null
  }
  if (body.maxAttempts !== undefined) {
    const m = body.maxAttempts === null || body.maxAttempts === '' ? null : Math.round(Number(body.maxAttempts))
    out.maxAttempts = m && Number.isFinite(m) && m > 0 ? Math.min(100, m) : null
  }
  if (body.shuffleQuestions !== undefined) out.shuffleQuestions = !!body.shuffleQuestions
  if (body.showFeedback !== undefined) {
    const sf = String(body.showFeedback).toUpperCase()
    if (!['IMMEDIATE', 'AFTER_SUBMIT'].includes(sf)) throw createError({ statusCode: 400, message: 'Invalid feedback mode' })
    out.showFeedback = sf
  }
  if (body.requiredForCompletion !== undefined) out.requiredForCompletion = !!body.requiredForCompletion
  return out
}

export async function addExercise(lessonId: string, courseId: string, body: Record<string, unknown>) {
  const v = exerciseValues(body, false)
  const db = useDb()
  const [last] = await db.select({ n: sql<number>`coalesce(max(${lessonExercises.position}), 0)::int` }).from(lessonExercises).where(eq(lessonExercises.lessonId, lessonId))
  const [ex] = await db.insert(lessonExercises).values({ ...v, title: v.title!, lessonId, position: (last?.n ?? 0) + 1 }).returning()
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, courseId))
  return ex!
}

export async function reorderExercises(lessonId: string, ids: string[]) {
  const db = useDb()
  const mine = (await db.select({ id: lessonExercises.id }).from(lessonExercises).where(eq(lessonExercises.lessonId, lessonId))).map(r => r.id)
  if (ids.length !== mine.length || ids.some(id => !mine.includes(id))) throw createError({ statusCode: 400, message: 'Give every exercise in order' })
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(lessonExercises).set({ position: i + 1 }).where(eq(lessonExercises.id, id))
  })
}

/**
 * Moves an exercise (quiz) to another lesson of the same course, or to another place in its own,
 * at `index` (0-based; past the end puts it last). Its questions and attempts go with it; both
 * lessons' exercises are numbered again.
 */
export async function moveExercise(exercise: Exercise, courseId: string, toLessonId: string, index: number) {
  const db = useDb()
  if (!/^[0-9a-f-]{36}$/i.test(toLessonId)) throw createError({ statusCode: 400, message: 'Pick a lesson' })
  const [target] = await db.select({ id: courseLessons.id, courseId: courseLessons.courseId }).from(courseLessons).where(eq(courseLessons.id, toLessonId)).limit(1)
  if (!target || target.courseId !== courseId) throw createError({ statusCode: 400, message: 'Pick a lesson of this course' })
  await db.transaction(async (tx) => {
    const order = async (lessonId: string) => (await tx.select({ id: lessonExercises.id }).from(lessonExercises)
      .where(eq(lessonExercises.lessonId, lessonId)).orderBy(asc(lessonExercises.position), asc(lessonExercises.createdAt))).map(r => r.id)
    const into = (await order(target.id)).filter(id => id !== exercise.id)
    into.splice(Math.max(0, Math.min(Math.round(index) || 0, into.length)), 0, exercise.id)
    await tx.update(lessonExercises).set({ lessonId: target.id, updatedAt: new Date() }).where(eq(lessonExercises.id, exercise.id))
    for (const [i, id] of into.entries()) await tx.update(lessonExercises).set({ position: i + 1 }).where(eq(lessonExercises.id, id))
    if (exercise.lessonId !== target.id) {
      for (const [i, id] of (await order(exercise.lessonId)).entries()) await tx.update(lessonExercises).set({ position: i + 1 }).where(eq(lessonExercises.id, id))
    }
  })
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, courseId))
}

export function questionValues(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<typeof exerciseQuestions.$inferInsert> = {}
  if (body.type !== undefined || !partial) {
    if (!isLmsQuestionType(body.type)) throw createError({ statusCode: 400, message: 'Unsupported LMS question type' })
    out.type = body.type
  }
  if (body.prompt !== undefined) out.prompt = text(body.prompt, 2000)
  if (body.context !== undefined) out.context = body.context == null ? null : String(body.context).slice(0, 20_000)
  if (body.audioRef !== undefined) out.audioRef = text(body.audioRef, 500) || null
  if (body.imageRef !== undefined) out.imageRef = text(body.imageRef, 500) || null
  if (body.config !== undefined) out.config = (body.config && typeof body.config === 'object') ? body.config : {}
  if (body.acceptedAnswers !== undefined) out.acceptedAnswers = body.acceptedAnswers ?? []
  if (body.explanation !== undefined) out.explanation = text(body.explanation, 4000) || null
  if (body.points !== undefined) {
    const p = Math.round(Number(body.points))
    out.points = Number.isFinite(p) && p >= 1 ? Math.min(100, p) : 1
  }
  return out
}

export async function addQuestion(exerciseId: string, courseId: string, body: Record<string, unknown>) {
  const v = questionValues(body, false)
  const db = useDb()
  const [last] = await db.select({ n: sql<number>`coalesce(max(${exerciseQuestions.position}), 0)::int` }).from(exerciseQuestions).where(eq(exerciseQuestions.exerciseId, exerciseId))
  const [q] = await db.insert(exerciseQuestions).values({ ...v, type: v.type!, exerciseId, position: (last?.n ?? 0) + 1 }).returning()
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, courseId))
  return q!
}

export async function reorderQuestions(exerciseId: string, ids: string[]) {
  const db = useDb()
  const mine = (await db.select({ id: exerciseQuestions.id }).from(exerciseQuestions).where(eq(exerciseQuestions.exerciseId, exerciseId))).map(r => r.id)
  if (ids.length !== mine.length || ids.some(id => !mine.includes(id))) throw createError({ statusCode: 400, message: 'Give every question in order' })
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.update(exerciseQuestions).set({ position: i + 1 }).where(eq(exerciseQuestions.id, id))
  })
}

/** Verify viewer may access an exercise (enrolled + lesson unlocked by drip, OR teacher/admin). */
async function checkExerciseAccess(viewer: Viewer, exercise: Exercise) {
  const lesson = await findLesson(exercise.lessonId)
  const course = await findCourse(lesson.courseId)
  const access = await accessTo(viewer, course)
  if (!access.see || !access.learn) throw createError({ statusCode: 403, message: 'Enroll in the course to access this exercise' })

  const { modules, lessons } = await loadOrderedCurriculum(course.id)
  const doneRows = lessons.length
    ? await useDb().select({ id: lessonProgress.lessonId }).from(lessonProgress).where(and(eq(lessonProgress.userId, viewer.id), inArray(lessonProgress.lessonId, lessons.map(l => l.id))))
    : []
  const dripMap = evaluateCourseDrip(course, modules, lessons, new Set(doneRows.map(r => r.id)), access.teaches)
  const drip = dripMap.get(lesson.id)
  if (!access.teaches && drip?.locked) {
    throw createError({ statusCode: 403, message: 'This lesson is currently locked by content drip', data: { code: 'DRIP_LOCKED', drip } })
  }
  const idx = lessons.findIndex(l => l.id === lesson.id)
  const nextL = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1]! : null
  const nextLesson = nextL ? { id: nextL.id, title: nextL.title, locked: !access.teaches && (dripMap.get(nextL.id)?.locked ?? false) } : null
  return { course, lesson, access, nextLesson }
}

export async function getExerciseView(viewer: Viewer, exercise: Exercise) {
  const { course, lesson, access, nextLesson } = await checkExerciseAccess(viewer, exercise)
  const db = useDb()
  const [qRows, attemptsRows, siblingRows] = await Promise.all([
    db.select().from(exerciseQuestions).where(eq(exerciseQuestions.exerciseId, exercise.id)).orderBy(asc(exerciseQuestions.position), asc(exerciseQuestions.createdAt)),
    db.select().from(exerciseAttempts).where(and(eq(exerciseAttempts.exerciseId, exercise.id), eq(exerciseAttempts.userId, viewer.id))).orderBy(desc(exerciseAttempts.submittedAt)).limit(20),
    db.select({ id: lessonExercises.id, position: lessonExercises.position, title: lessonExercises.title })
      .from(lessonExercises)
      .where(eq(lessonExercises.lessonId, exercise.lessonId))
      .orderBy(asc(lessonExercises.position), asc(lessonExercises.createdAt))
  ])

  const siblingIds = siblingRows.map(s => s.id)
  const passedSiblingRows = siblingIds.length
    ? await db.selectDistinct({ exerciseId: exerciseAttempts.exerciseId })
        .from(exerciseAttempts)
        .where(and(
          eq(exerciseAttempts.userId, viewer.id),
          eq(exerciseAttempts.passed, true),
          inArray(exerciseAttempts.exerciseId, siblingIds)
        ))
    : []
  const passedSet = new Set(passedSiblingRows.map(r => r.exerciseId))

  const questions = access.teaches
    ? qRows
    : (exercise.shuffleQuestions ? shuffleDeterministic(qRows, `${exercise.id}:${viewer.id}:${attemptsRows.length}`) : qRows).map(sanitizeQuestionForStudent)

  return {
    ...exercise,
    teaches: access.teaches,
    course: { id: course.id, slug: course.slug, title: course.title },
    lesson: { id: lesson.id, title: lesson.title, next: nextLesson },
    siblings: siblingRows.map(s => ({ ...s, passed: passedSet.has(s.id) })),
    questions,
    attempts: attemptsRows
  }
}

export async function submitExercise(viewer: Viewer, exercise: Exercise, body: Record<string, unknown>) {
  const { lesson, access } = await checkExerciseAccess(viewer, exercise)
  const db = useDb()

  const prevAttempts = await db.select({ id: exerciseAttempts.id }).from(exerciseAttempts)
    .where(and(eq(exerciseAttempts.exerciseId, exercise.id), eq(exerciseAttempts.userId, viewer.id)))

  if (!access.teaches && exercise.maxAttempts && prevAttempts.length >= exercise.maxAttempts) {
    throw createError({ statusCode: 400, message: `Maximum attempts (${exercise.maxAttempts}) reached for this exercise` })
  }

  const qRows: Question[] = await db.select().from(exerciseQuestions)
    .where(eq(exerciseQuestions.exerciseId, exercise.id))
    .orderBy(asc(exerciseQuestions.position), asc(exerciseQuestions.createdAt))

  const submittedMap = (body.answers && typeof body.answers === 'object' ? body.answers : {}) as Record<string, unknown>
  const durationSeconds = Number.isFinite(Number(body.durationSeconds)) ? Math.max(0, Math.round(Number(body.durationSeconds))) : null

  const results: Record<string, LmsQuestionGrade> = {}
  let earnedPoints = 0
  let totalPoints = 0

  for (const q of qRows) results[q.id] = gradeLmsQuestion(q, submittedMap[q.id])
  // Written responses: marked by the AI now (the teacher may look again).
  const reviewStatus = await markWrittenResponses(qRows, submittedMap, results, viewer.id)
  for (const g of Object.values(results)) {
    earnedPoints += g.earned
    totalPoints += g.max
  }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100
  const passed = score >= exercise.passingScore

  const [attempt] = await db.insert(exerciseAttempts).values({
    exerciseId: exercise.id,
    userId: viewer.id,
    answers: submittedMap,
    results,
    score,
    earnedPoints,
    totalPoints,
    passed,
    durationSeconds,
    reviewStatus
  }).returning()

  // If this lesson has required exercises and all are now passed by the student, mark the lesson done automatically.
  let autoCompletedLesson = false
  if (passed && !access.teaches) {
    const requiredExercises = await db.select({ id: lessonExercises.id }).from(lessonExercises)
      .where(and(eq(lessonExercises.lessonId, lesson.id), eq(lessonExercises.requiredForCompletion, true)))
    if (requiredExercises.length > 0) {
      const passedRows = await db.selectDistinct({ exerciseId: exerciseAttempts.exerciseId }).from(exerciseAttempts)
        .where(and(
          eq(exerciseAttempts.userId, viewer.id),
          eq(exerciseAttempts.passed, true),
          inArray(exerciseAttempts.exerciseId, requiredExercises.map(r => r.id))
        ))
      if (passedRows.length >= requiredExercises.length) {
        await db.insert(lessonProgress).values({ lessonId: lesson.id, userId: viewer.id }).onConflictDoNothing()
        await awardXpQuietly(viewer.id, 'lesson', XP.lesson, `lesson:${lesson.id}`)
        autoCompletedLesson = true
      }
    }
  }

  // XP the first time a quiz is passed.
  const xpGained = passed && !access.teaches ? await awardXpQuietly(viewer.id, 'quiz', XP.quiz, `quiz:${exercise.id}`) : 0
  return { attempt: attempt!, autoCompletedLesson, xpGained }
}
