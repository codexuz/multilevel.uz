import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  courseLessons,
  courseSpeakingAssessments,
  courseSpeakingComments,
  courseSpeakingLikes,
  courseSpeakingQuestions,
  courseSpeakingRecordings,
  courses,
  lessonExercises,
  users
} from '../database/schema'
import type { CourseSpeakingAiReview } from './ai-speaking'

type Viewer = { id: string, role: string }
type CourseRow = typeof courses.$inferSelect

const UUID_RE = /^[0-9a-f-]{36}$/i
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const displayName = (u?: { name: string | null, telegramUsername: string | null, email: string | null }) =>
  u?.name || (u?.telegramUsername ? `@${u.telegramUsername}` : u?.email) || 'Learner'

function validUrl(v: unknown): string | null {
  const s = text(v, 1000)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null
  } catch {
    return null
  }
}

/** 0–9 IELTS-style band rating scale. */
function rating(v: unknown, required: boolean): number | null {
  if (v === undefined || v === null || v === '') {
    if (required) throw createError({ statusCode: 400, message: 'Provide a rating from 0 to 9' })
    return null
  }
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n < 0 || n > 9) throw createError({ statusCode: 400, message: 'Rating must be between 0 and 9' })
  return n
}

export async function findSpeakingQuestion(id: string) {
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, message: 'Speaking question not found' })
  const [row] = await useDb().select().from(courseSpeakingQuestions).where(eq(courseSpeakingQuestions.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Speaking question not found' })
  return row
}

export async function findSpeakingRecording(id: string) {
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, message: 'Recording not found' })
  const [row] = await useDb().select().from(courseSpeakingRecordings).where(eq(courseSpeakingRecordings.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Recording not found' })
  return row
}

export async function findSpeakingComment(id: string) {
  if (!UUID_RE.test(id)) throw createError({ statusCode: 404, message: 'Comment not found' })
  const [row] = await useDb().select().from(courseSpeakingComments).where(eq(courseSpeakingComments.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Comment not found' })
  return row
}

/** Verifies the viewer is enrolled in (or teaches) the course. */
export async function requireSpeakingAccess(viewer: Viewer, courseKey: string) {
  const course = await findCourse(courseKey)
  const access = await accessTo(viewer, course)
  if (!access.see || !access.learn) {
    throw createError({ statusCode: 403, message: 'Enroll in the course to access Speaking Studio', data: { code: 'ENROLL_REQUIRED', slug: course.slug } })
  }
  return { course, access }
}

export function speakingQuestionValues(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<typeof courseSpeakingQuestions.$inferInsert> = {}
  if (body.title !== undefined || !partial) {
    const title = text(body.title, 160)
    if (!title) throw createError({ statusCode: 400, message: 'Give the speaking question a title' })
    out.title = title
  }
  if (body.prompt !== undefined || !partial) {
    const prompt = text(body.prompt, 3000)
    if (!prompt) throw createError({ statusCode: 400, message: 'Write the speaking prompt' })
    out.prompt = prompt
  }
  if (body.tips !== undefined) out.tips = text(body.tips, 2000) || null
  if (body.partLabel !== undefined) out.partLabel = text(body.partLabel, 60) || null
  if (body.suggestedSeconds !== undefined) {
    const s = body.suggestedSeconds === null || body.suggestedSeconds === '' ? null : Math.round(Number(body.suggestedSeconds))
    out.suggestedSeconds = s && Number.isFinite(s) && s >= 10 ? Math.min(600, s) : null
  }
  return out
}

export async function createSpeakingQuestion(course: CourseRow, userId: string, body: Record<string, unknown>) {
  const v = speakingQuestionValues(body, false)
  const db = useDb()
  let exerciseId: string | null = null
  let lessonId: string | null = null

  if (body.exerciseId) {
    const rawExId = String(body.exerciseId)
    if (!UUID_RE.test(rawExId)) throw createError({ statusCode: 400, message: 'Invalid exercise' })
    const [exRow] = await db
      .select({ id: lessonExercises.id, lessonId: lessonExercises.lessonId, courseId: courseLessons.courseId })
      .from(lessonExercises)
      .innerJoin(courseLessons, eq(courseLessons.id, lessonExercises.lessonId))
      .where(eq(lessonExercises.id, rawExId))
      .limit(1)
    if (!exRow || exRow.courseId !== course.id) {
      throw createError({ statusCode: 400, message: 'Exercise does not belong to this course' })
    }
    exerciseId = exRow.id
    lessonId = exRow.lessonId
  } else if (body.lessonId) {
    const rawLessonId = String(body.lessonId)
    if (!UUID_RE.test(rawLessonId)) throw createError({ statusCode: 400, message: 'Invalid lesson' })
    const [lRow] = await db.select({ id: courseLessons.id, courseId: courseLessons.courseId }).from(courseLessons).where(eq(courseLessons.id, rawLessonId)).limit(1)
    if (!lRow || lRow.courseId !== course.id) {
      throw createError({ statusCode: 400, message: 'Lesson does not belong to this course' })
    }
    lessonId = lRow.id
  }

  const posWhere = exerciseId
    ? eq(courseSpeakingQuestions.exerciseId, exerciseId)
    : eq(courseSpeakingQuestions.courseId, course.id)
  const [last] = await db.select({ n: sql<number>`coalesce(max(${courseSpeakingQuestions.position}), 0)::int` })
    .from(courseSpeakingQuestions)
    .where(posWhere)
  const [q] = await db.insert(courseSpeakingQuestions).values({
    ...v,
    title: v.title!,
    prompt: v.prompt!,
    courseId: course.id,
    exerciseId,
    lessonId,
    position: (last?.n ?? 0) + 1,
    createdById: userId
  }).returning()
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return q!
}

export async function updateSpeakingQuestion(courseId: string, questionId: string, body: Record<string, unknown>) {
  const q = await findSpeakingQuestion(questionId)
  if (q.courseId !== courseId) throw createError({ statusCode: 404, message: 'Speaking question not found in this course' })
  const v = speakingQuestionValues(body, true)
  const db = useDb()
  const [updated] = await db.update(courseSpeakingQuestions)
    .set({ ...v, updatedAt: new Date() })
    .where(eq(courseSpeakingQuestions.id, q.id))
    .returning()
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, courseId))
  return updated!
}

export async function deleteSpeakingQuestion(courseId: string, questionId: string) {
  const q = await findSpeakingQuestion(questionId)
  if (q.courseId !== courseId) throw createError({ statusCode: 404, message: 'Speaking question not found in this course' })
  const db = useDb()
  await db.delete(courseSpeakingQuestions).where(eq(courseSpeakingQuestions.id, q.id))
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, courseId))
}

/** Overview of speaking questions for a course, lesson, or specific SPEAKING exercise. */
export async function speakingStudioOverview(
  viewer: Viewer,
  courseKey: string,
  opts: { exerciseId?: string, lessonId?: string } = {}
) {
  const { course, access } = await requireSpeakingAccess(viewer, courseKey)
  const db = useDb()
  const qFilters = [eq(courseSpeakingQuestions.courseId, course.id)]
  if (opts.exerciseId && UUID_RE.test(opts.exerciseId)) {
    qFilters.push(eq(courseSpeakingQuestions.exerciseId, opts.exerciseId))
  } else if (opts.lessonId && UUID_RE.test(opts.lessonId)) {
    qFilters.push(eq(courseSpeakingQuestions.lessonId, opts.lessonId))
  }
  const questions = await db.select().from(courseSpeakingQuestions)
    .where(and(...qFilters))
    .orderBy(asc(courseSpeakingQuestions.position), asc(courseSpeakingQuestions.createdAt))

  const qIds = questions.map(q => q.id)
  const [counts, myCounts] = qIds.length
    ? await Promise.all([
        db.select({ questionId: courseSpeakingRecordings.questionId, n: count() })
          .from(courseSpeakingRecordings)
          .where(inArray(courseSpeakingRecordings.questionId, qIds))
          .groupBy(courseSpeakingRecordings.questionId),
        db.select({ questionId: courseSpeakingRecordings.questionId, n: count() })
          .from(courseSpeakingRecordings)
          .where(and(inArray(courseSpeakingRecordings.questionId, qIds), eq(courseSpeakingRecordings.userId, viewer.id)))
          .groupBy(courseSpeakingRecordings.questionId)
      ])
    : [[], []]

  const countMap = new Map(counts.map(r => [r.questionId, Number(r.n)]))
  const myCountMap = new Map(myCounts.map(r => [r.questionId, Number(r.n)]))

  const enriched = questions.map(q => ({
    ...q,
    recordingsCount: countMap.get(q.id) ?? 0,
    myRecordingsCount: myCountMap.get(q.id) ?? 0
  }))

  const totalRecordings = enriched.reduce((sum, q) => sum + q.recordingsCount, 0)
  const myRecordings = enriched.reduce((sum, q) => sum + q.myRecordingsCount, 0)

  return {
    course: { id: course.id, slug: course.slug, title: course.title },
    teaches: access.teaches,
    aiEnabled: speakingAiEnabled(),
    questions: enriched,
    totalRecordings,
    myRecordings
  }
}

function summarizeAssessments(
  rows: Array<typeof courseSpeakingAssessments.$inferSelect>,
  teacherUserIds: Set<string>
) {
  const avg = (vals: Array<number | null>) => {
    const nums = vals.filter((v): v is number => typeof v === 'number')
    return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null
  }
  const teacherRows = rows.filter(r => teacherUserIds.has(r.userId))
  const peerRows = rows.filter(r => !teacherUserIds.has(r.userId))
  return {
    count: rows.length,
    avgOverall: avg(rows.map(r => r.overall)),
    avgFluency: avg(rows.map(r => r.fluency)),
    avgVocabulary: avg(rows.map(r => r.vocabulary)),
    avgGrammar: avg(rows.map(r => r.grammar)),
    avgPronunciation: avg(rows.map(r => r.pronunciation)),
    teacherCount: teacherRows.length,
    teacherAvgOverall: avg(teacherRows.map(r => r.overall)),
    peerCount: peerRows.length,
    peerAvgOverall: avg(peerRows.map(r => r.overall))
  }
}

/** Paginated feed of recorded speaking answers (course-wide, lesson-wide, or exercise-scoped). */
export async function listSpeakingRecordings(
  viewer: Viewer,
  courseKey: string,
  opts: { questionId?: string, exerciseId?: string, lessonId?: string, mine?: boolean, page?: number, limit?: number }
) {
  const { course, access } = await requireSpeakingAccess(viewer, courseKey)
  const db = useDb()

  const page = Math.max(1, Math.round(Number(opts.page) || 1))
  const limit = Math.min(30, Math.max(1, Math.round(Number(opts.limit) || 10)))
  const offset = (page - 1) * limit

  const filters = [eq(courseSpeakingRecordings.courseId, course.id)]
  if (opts.questionId && UUID_RE.test(opts.questionId)) {
    filters.push(eq(courseSpeakingRecordings.questionId, opts.questionId))
  } else if (opts.exerciseId && UUID_RE.test(opts.exerciseId)) {
    const exQs = await db.select({ id: courseSpeakingQuestions.id }).from(courseSpeakingQuestions)
      .where(and(eq(courseSpeakingQuestions.courseId, course.id), eq(courseSpeakingQuestions.exerciseId, opts.exerciseId)))
    if (!exQs.length) return { items: [], total: 0, page, limit, pages: 1 }
    filters.push(inArray(courseSpeakingRecordings.questionId, exQs.map(q => q.id)))
  } else if (opts.lessonId && UUID_RE.test(opts.lessonId)) {
    const lessonQs = await db.select({ id: courseSpeakingQuestions.id }).from(courseSpeakingQuestions)
      .where(and(eq(courseSpeakingQuestions.courseId, course.id), eq(courseSpeakingQuestions.lessonId, opts.lessonId)))
    if (!lessonQs.length) return { items: [], total: 0, page, limit, pages: 1 }
    filters.push(inArray(courseSpeakingRecordings.questionId, lessonQs.map(q => q.id)))
  }
  if (opts.mine) {
    filters.push(eq(courseSpeakingRecordings.userId, viewer.id))
  }
  const where = and(...filters)

  const [[totalRow], recRows] = await Promise.all([
    db.select({ n: count() }).from(courseSpeakingRecordings).where(where),
    db.select().from(courseSpeakingRecordings)
      .where(where)
      .orderBy(desc(courseSpeakingRecordings.createdAt))
      .limit(limit)
      .offset(offset)
  ])

  const total = Number(totalRow?.n ?? 0)
  const pages = Math.max(1, Math.ceil(total / limit))

  if (!recRows.length) {
    return { items: [], total, page, limit, pages }
  }

  const recIds = recRows.map(r => r.id)
  const qIds = [...new Set(recRows.map(r => r.questionId))]

  const [qRows, assessRows, commentCounts, likeRows] = await Promise.all([
    db.select({
      id: courseSpeakingQuestions.id,
      title: courseSpeakingQuestions.title,
      prompt: courseSpeakingQuestions.prompt,
      partLabel: courseSpeakingQuestions.partLabel,
      lessonId: courseSpeakingQuestions.lessonId,
      exerciseId: courseSpeakingQuestions.exerciseId
    }).from(courseSpeakingQuestions).where(inArray(courseSpeakingQuestions.id, qIds)),
    db.select().from(courseSpeakingAssessments).where(inArray(courseSpeakingAssessments.recordingId, recIds)),
    db.select({ recordingId: courseSpeakingComments.recordingId, n: count() })
      .from(courseSpeakingComments)
      .where(inArray(courseSpeakingComments.recordingId, recIds))
      .groupBy(courseSpeakingComments.recordingId),
    db.select({ recordingId: courseSpeakingLikes.recordingId, userId: courseSpeakingLikes.userId })
      .from(courseSpeakingLikes)
      .where(inArray(courseSpeakingLikes.recordingId, recIds))
  ])

  const userIds = [...new Set([
    ...recRows.map(r => r.userId),
    ...assessRows.map(a => a.userId)
  ])]
  const userRows = userIds.length
    ? await db.select({
        id: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role
      }).from(users).where(inArray(users.id, userIds))
    : []

  const qMap = new Map(qRows.map(q => [q.id, q]))
  const uMap = new Map(userRows.map(u => [u.id, u]))
  const cCountMap = new Map(commentCounts.map(c => [c.recordingId, Number(c.n)]))
  const teacherUserIds = new Set(
    userRows.filter(u => u.id === course.teacherId || u.role === 'admin').map(u => u.id)
  )

  const items = recRows.map((rec) => {
    const q = qMap.get(rec.questionId)
    const author = uMap.get(rec.userId)
    const recAssess = assessRows.filter(a => a.recordingId === rec.id)
    const mine = recAssess.find(a => a.userId === viewer.id) ?? null
    const recLikes = likeRows.filter(l => l.recordingId === rec.id)
    const isMine = rec.userId === viewer.id
    return {
      id: rec.id,
      questionId: rec.questionId,
      lessonId: q?.lessonId ?? null,
      exerciseId: q?.exerciseId ?? null,
      questionTitle: q?.title ?? '',
      questionPrompt: q?.prompt ?? '',
      questionPartLabel: q?.partLabel ?? null,
      audioUrl: rec.audioUrl,
      durationSeconds: rec.durationSeconds,
      note: rec.note,
      aiReview: (rec.aiReview as CourseSpeakingAiReview | null) ?? null,
      createdAt: rec.createdAt,
      author: {
        id: rec.userId,
        name: displayName(author),
        avatarUrl: author?.avatarUrl ?? null,
        isTeacher: rec.userId === course.teacherId || author?.role === 'admin'
      },
      isMine,
      teaches: access.teaches,
      canAssess: !isMine || access.teaches,
      canAiAssess: (access.teaches || isMine) && speakingAiEnabled(),
      canDelete: isMine || access.teaches,
      likesCount: recLikes.length,
      likedByMe: recLikes.some(l => l.userId === viewer.id),
      assessmentSummary: summarizeAssessments(recAssess, teacherUserIds),
      myAssessment: mine
        ? {
            overall: mine.overall,
            fluency: mine.fluency,
            vocabulary: mine.vocabulary,
            grammar: mine.grammar,
            pronunciation: mine.pronunciation
          }
        : null,
      commentsCount: cCountMap.get(rec.id) ?? 0
    }
  })

  return { items, total, page, limit, pages }
}

/** Full Facebook/Instagram-style detail view of a single speaking recording: comments, likes & 0-9 ratings. */
export async function getSpeakingRecordingDetail(viewer: Viewer, recordingId: string) {
  const rec = await findSpeakingRecording(recordingId)
  const { course, access } = await requireSpeakingAccess(viewer, rec.courseId)
  const db = useDb()

  const [[question], assessRows, commentRows, likeRows] = await Promise.all([
    db.select().from(courseSpeakingQuestions).where(eq(courseSpeakingQuestions.id, rec.questionId)).limit(1),
    db.select().from(courseSpeakingAssessments)
      .where(eq(courseSpeakingAssessments.recordingId, rec.id))
      .orderBy(desc(courseSpeakingAssessments.updatedAt)),
    db.select().from(courseSpeakingComments)
      .where(eq(courseSpeakingComments.recordingId, rec.id))
      .orderBy(asc(courseSpeakingComments.createdAt)),
    db.select().from(courseSpeakingLikes)
      .where(eq(courseSpeakingLikes.recordingId, rec.id))
      .orderBy(desc(courseSpeakingLikes.createdAt))
  ])

  const userIds = [...new Set([
    rec.userId,
    ...assessRows.map(a => a.userId),
    ...commentRows.map(c => c.userId),
    ...likeRows.map(l => l.userId)
  ])]
  const userRows = userIds.length
    ? await db.select({
        id: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role
      }).from(users).where(inArray(users.id, userIds))
    : []

  const uMap = new Map(userRows.map(u => [u.id, u]))
  const teacherUserIds = new Set(
    userRows.filter(u => u.id === course.teacherId || u.role === 'admin').map(u => u.id)
  )
  const authorOf = (uid: string) => {
    const u = uMap.get(uid)
    return {
      id: uid,
      name: displayName(u),
      avatarUrl: u?.avatarUrl ?? null,
      isTeacher: teacherUserIds.has(uid)
    }
  }

  const mine = assessRows.find(a => a.userId === viewer.id) ?? null
  const isMine = rec.userId === viewer.id

  return {
    course: { id: course.id, slug: course.slug, title: course.title },
    teaches: access.teaches,
    recording: {
      id: rec.id,
      questionId: rec.questionId,
      lessonId: question?.lessonId ?? null,
      exerciseId: question?.exerciseId ?? null,
      questionTitle: question?.title ?? '',
      questionPrompt: question?.prompt ?? '',
      questionPartLabel: question?.partLabel ?? null,
      questionTips: question?.tips ?? null,
      audioUrl: rec.audioUrl,
      durationSeconds: rec.durationSeconds,
      note: rec.note,
      aiReview: (rec.aiReview as CourseSpeakingAiReview | null) ?? null,
      createdAt: rec.createdAt,
      author: authorOf(rec.userId),
      isMine,
      teaches: access.teaches,
      canAssess: !isMine || access.teaches,
      canAiAssess: (access.teaches || isMine) && speakingAiEnabled(),
      canDelete: isMine || access.teaches,
      likesCount: likeRows.length,
      likedByMe: likeRows.some(l => l.userId === viewer.id),
      assessmentSummary: summarizeAssessments(assessRows, teacherUserIds),
      myAssessment: mine
        ? {
            overall: mine.overall,
            fluency: mine.fluency,
            vocabulary: mine.vocabulary,
            grammar: mine.grammar,
            pronunciation: mine.pronunciation
          }
        : null,
      commentsCount: commentRows.length
    },
    likes: likeRows.map(l => ({
      ...authorOf(l.userId),
      createdAt: l.createdAt
    })),
    assessments: assessRows.map(a => ({
      id: a.id,
      overall: a.overall,
      fluency: a.fluency,
      vocabulary: a.vocabulary,
      grammar: a.grammar,
      pronunciation: a.pronunciation,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      author: authorOf(a.userId)
    })),
    comments: commentRows.map(c => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: authorOf(c.userId),
      canDelete: c.userId === viewer.id || access.teaches
    }))
  }
}

/** Saves an uploaded voice recording answering a speaking studio/lesson question. */
export async function createSpeakingRecording(viewer: Viewer, courseKey: string, body: Record<string, unknown>) {
  const { course, access } = await requireSpeakingAccess(viewer, courseKey)
  const questionId = String(body.questionId ?? '')
  const question = await findSpeakingQuestion(questionId)
  if (question.courseId !== course.id) {
    throw createError({ statusCode: 400, message: 'Question does not belong to this course' })
  }
  const audioUrl = validUrl(body.audioUrl)
  if (!audioUrl) throw createError({ statusCode: 400, message: 'Valid audio recording URL is required' })

  const dur = body.durationSeconds === undefined || body.durationSeconds === null || body.durationSeconds === ''
    ? null
    : Math.round(Number(body.durationSeconds))
  const durationSeconds = dur && Number.isFinite(dur) && dur > 0 ? Math.min(1800, dur) : null
  const note = text(body.note, 1000) || null

  const [created] = await useDb().insert(courseSpeakingRecordings).values({
    questionId: question.id,
    courseId: course.id,
    userId: viewer.id,
    audioUrl,
    durationSeconds,
    note
  }).returning()

  const xpGained = !access.teaches
    ? await awardXpQuietly(viewer.id, 'lesson', XP.lesson, `speaking:${question.id}`)
    : 0

  return { recording: created!, xpGained }
}

export async function deleteSpeakingRecording(viewer: Viewer, recordingId: string) {
  const rec = await findSpeakingRecording(recordingId)
  const course = await findCourse(rec.courseId)
  const access = await accessTo(viewer, course)
  if (rec.userId !== viewer.id && !access.teaches) {
    throw createError({ statusCode: 403, message: 'You cannot delete this recording' })
  }
  await useDb().delete(courseSpeakingRecordings).where(eq(courseSpeakingRecordings.id, rec.id))
}

/** Toggles a like on a speaking recording (Facebook/Instagram-style). */
export async function toggleSpeakingLike(viewer: Viewer, recordingId: string) {
  const rec = await findSpeakingRecording(recordingId)
  await requireSpeakingAccess(viewer, rec.courseId)
  const db = useDb()
  const [existing] = await db.select({ userId: courseSpeakingLikes.userId })
    .from(courseSpeakingLikes)
    .where(and(eq(courseSpeakingLikes.recordingId, rec.id), eq(courseSpeakingLikes.userId, viewer.id)))
    .limit(1)

  let liked: boolean
  if (existing) {
    await db.delete(courseSpeakingLikes)
      .where(and(eq(courseSpeakingLikes.recordingId, rec.id), eq(courseSpeakingLikes.userId, viewer.id)))
    liked = false
  } else {
    await db.insert(courseSpeakingLikes).values({ recordingId: rec.id, userId: viewer.id }).onConflictDoNothing()
    liked = true
  }

  const [row] = await db.select({ n: count() }).from(courseSpeakingLikes).where(eq(courseSpeakingLikes.recordingId, rec.id))
  return { liked, likesCount: Number(row?.n ?? 0) }
}

/**
 * Submits or updates a 0–9 rating/assessment on a speaking recording:
 * - Teachers/admins may rate overall (0–9) + optional criteria (fluency, vocabulary, grammar, pronunciation, 0–9).
 * - Other students may rate ONLY overall (0–9).
 */
export async function upsertSpeakingAssessment(viewer: Viewer, recordingId: string, body: Record<string, unknown>) {
  const rec = await findSpeakingRecording(recordingId)
  const { course, access } = await requireSpeakingAccess(viewer, rec.courseId)
  if (rec.userId === viewer.id && !access.teaches) {
    throw createError({ statusCode: 400, message: 'You cannot rate your own recording' })
  }

  const values = {
    overall: rating(body.overall, true)!,
    fluency: access.teaches ? rating(body.fluency, false) : null,
    vocabulary: access.teaches ? rating(body.vocabulary, false) : null,
    grammar: access.teaches ? rating(body.grammar, false) : null,
    pronunciation: access.teaches ? rating(body.pronunciation, false) : null
  }

  const db = useDb()
  await db.insert(courseSpeakingAssessments).values({
    recordingId: rec.id,
    userId: viewer.id,
    ...values
  }).onConflictDoUpdate({
    target: [courseSpeakingAssessments.recordingId, courseSpeakingAssessments.userId],
    set: { ...values, updatedAt: new Date() }
  })

  const all = await db.select().from(courseSpeakingAssessments).where(eq(courseSpeakingAssessments.recordingId, rec.id))
  const reviewerIds = [...new Set(all.map(a => a.userId))]
  const reviewerRows = reviewerIds.length
    ? await db.select({ id: users.id, role: users.role }).from(users).where(inArray(users.id, reviewerIds))
    : []
  const teacherUserIds = new Set(
    reviewerRows.filter(u => u.id === course.teacherId || u.role === 'admin').map(u => u.id)
  )

  return {
    assessmentSummary: summarizeAssessments(all, teacherUserIds),
    myAssessment: values
  }
}

/** Runs AI speaking assessment (0–9 band scale) on a speaking recording and stores it on the recording. */
export async function aiAssessSpeakingRecording(viewer: Viewer, recordingId: string) {
  const rec = await findSpeakingRecording(recordingId)
  const { access } = await requireSpeakingAccess(viewer, rec.courseId)
  if (!access.teaches && rec.userId !== viewer.id) {
    throw createError({ statusCode: 403, message: 'Only the teacher or speaker can request AI assessment' })
  }
  const db = useDb()
  const [question] = await db.select().from(courseSpeakingQuestions).where(eq(courseSpeakingQuestions.id, rec.questionId)).limit(1)
  if (!question) throw createError({ statusCode: 404, message: 'Speaking question not found' })

  let articleContext: string | null = null
  if (question.lessonId) {
    const [lesson] = await db.select({ body: courseLessons.body }).from(courseLessons).where(eq(courseLessons.id, question.lessonId)).limit(1)
    articleContext = lesson?.body ?? null
  }

  const aiReview = await assessSingleSpeakingClip({
    audioRef: rec.audioUrl,
    questionTitle: question.title,
    questionPrompt: question.prompt,
    articleContext,
    durationSeconds: rec.durationSeconds,
    userId: viewer.id
  })

  await db.update(courseSpeakingRecordings)
    .set({ aiReview, updatedAt: new Date() })
    .where(eq(courseSpeakingRecordings.id, rec.id))

  return { aiReview }
}

export async function createSpeakingComment(viewer: Viewer, recordingId: string, body: Record<string, unknown>) {
  const rec = await findSpeakingRecording(recordingId)
  const { course, access } = await requireSpeakingAccess(viewer, rec.courseId)
  const content = text(body.body, 1000)
  if (!content) throw createError({ statusCode: 400, message: 'Write a comment first' })

  const db = useDb()
  const [inserted] = await db.insert(courseSpeakingComments).values({
    recordingId: rec.id,
    userId: viewer.id,
    body: content
  }).returning()

  const [author] = await db.select({
    id: users.id,
    name: users.name,
    telegramUsername: users.telegramUsername,
    email: users.email,
    avatarUrl: users.avatarUrl,
    role: users.role
  }).from(users).where(eq(users.id, viewer.id)).limit(1)

  return {
    id: inserted!.id,
    body: inserted!.body,
    createdAt: inserted!.createdAt,
    author: {
      id: viewer.id,
      name: displayName(author),
      avatarUrl: author?.avatarUrl ?? null,
      isTeacher: viewer.id === course.teacherId || author?.role === 'admin' || access.teaches
    },
    canDelete: true
  }
}

export async function deleteSpeakingComment(viewer: Viewer, commentId: string) {
  const comment = await findSpeakingComment(commentId)
  const rec = await findSpeakingRecording(comment.recordingId)
  const course = await findCourse(rec.courseId)
  const access = await accessTo(viewer, course)
  if (comment.userId !== viewer.id && !access.teaches) {
    throw createError({ statusCode: 403, message: 'You cannot delete this comment' })
  }
  await useDb().delete(courseSpeakingComments).where(eq(courseSpeakingComments.id, comment.id))
}
