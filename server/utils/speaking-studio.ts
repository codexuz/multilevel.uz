import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  courseSpeakingAssessments,
  courseSpeakingComments,
  courseSpeakingQuestions,
  courseSpeakingRecordings,
  courses,
  users
} from '../database/schema'

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

function rating(v: unknown, required: boolean): number | null {
  if (v === undefined || v === null || v === '') {
    if (required) throw createError({ statusCode: 400, message: 'Provide a rating from 1 to 5' })
    return null
  }
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n < 1 || n > 5) throw createError({ statusCode: 400, message: 'Rating must be between 1 and 5' })
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
  const [last] = await db.select({ n: sql<number>`coalesce(max(${courseSpeakingQuestions.position}), 0)::int` })
    .from(courseSpeakingQuestions)
    .where(eq(courseSpeakingQuestions.courseId, course.id))
  const [q] = await db.insert(courseSpeakingQuestions).values({
    ...v,
    title: v.title!,
    prompt: v.prompt!,
    courseId: course.id,
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

/** Overview of a course's Speaking Studio: all questions with recording counts. */
export async function speakingStudioOverview(viewer: Viewer, courseKey: string) {
  const { course, access } = await requireSpeakingAccess(viewer, courseKey)
  const db = useDb()
  const [questions, counts, myCounts] = await Promise.all([
    db.select().from(courseSpeakingQuestions)
      .where(eq(courseSpeakingQuestions.courseId, course.id))
      .orderBy(asc(courseSpeakingQuestions.position), asc(courseSpeakingQuestions.createdAt)),
    db.select({ questionId: courseSpeakingRecordings.questionId, n: count() })
      .from(courseSpeakingRecordings)
      .where(eq(courseSpeakingRecordings.courseId, course.id))
      .groupBy(courseSpeakingRecordings.questionId),
    db.select({ questionId: courseSpeakingRecordings.questionId, n: count() })
      .from(courseSpeakingRecordings)
      .where(and(eq(courseSpeakingRecordings.courseId, course.id), eq(courseSpeakingRecordings.userId, viewer.id)))
      .groupBy(courseSpeakingRecordings.questionId)
  ])

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
    questions: enriched,
    totalRecordings,
    myRecordings
  }
}

function summarizeAssessments(rows: Array<typeof courseSpeakingAssessments.$inferSelect>) {
  const avg = (vals: Array<number | null>) => {
    const nums = vals.filter((v): v is number => typeof v === 'number')
    return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null
  }
  return {
    count: rows.length,
    avgOverall: avg(rows.map(r => r.overall)),
    avgFluency: avg(rows.map(r => r.fluency)),
    avgVocabulary: avg(rows.map(r => r.vocabulary)),
    avgGrammar: avg(rows.map(r => r.grammar)),
    avgPronunciation: avg(rows.map(r => r.pronunciation))
  }
}

/** Paginated feed of recorded speaking answers in a course, with assessments and comments. */
export async function listSpeakingRecordings(
  viewer: Viewer,
  courseKey: string,
  opts: { questionId?: string, mine?: boolean, page?: number, limit?: number }
) {
  const { course, access } = await requireSpeakingAccess(viewer, courseKey)
  const db = useDb()

  const page = Math.max(1, Math.round(Number(opts.page) || 1))
  const limit = Math.min(30, Math.max(1, Math.round(Number(opts.limit) || 10)))
  const offset = (page - 1) * limit

  const filters = [eq(courseSpeakingRecordings.courseId, course.id)]
  if (opts.questionId && UUID_RE.test(opts.questionId)) {
    filters.push(eq(courseSpeakingRecordings.questionId, opts.questionId))
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

  const [qRows, assessRows, commentRows] = await Promise.all([
    db.select({
      id: courseSpeakingQuestions.id,
      title: courseSpeakingQuestions.title,
      prompt: courseSpeakingQuestions.prompt,
      partLabel: courseSpeakingQuestions.partLabel
    }).from(courseSpeakingQuestions).where(inArray(courseSpeakingQuestions.id, qIds)),
    db.select().from(courseSpeakingAssessments).where(inArray(courseSpeakingAssessments.recordingId, recIds)),
    db.select().from(courseSpeakingComments)
      .where(inArray(courseSpeakingComments.recordingId, recIds))
      .orderBy(asc(courseSpeakingComments.createdAt))
  ])

  const userIds = [...new Set([
    ...recRows.map(r => r.userId),
    ...commentRows.map(c => c.userId)
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

  const items = recRows.map((rec) => {
    const q = qMap.get(rec.questionId)
    const author = uMap.get(rec.userId)
    const recAssess = assessRows.filter(a => a.recordingId === rec.id)
    const mine = recAssess.find(a => a.userId === viewer.id) ?? null
    const recComments = commentRows.filter(c => c.recordingId === rec.id).map((c) => {
      const ca = uMap.get(c.userId)
      return {
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: {
          id: c.userId,
          name: displayName(ca),
          avatarUrl: ca?.avatarUrl ?? null,
          isTeacher: c.userId === course.teacherId || ca?.role === 'admin'
        },
        canDelete: c.userId === viewer.id || access.teaches
      }
    })

    const isMine = rec.userId === viewer.id
    return {
      id: rec.id,
      questionId: rec.questionId,
      questionTitle: q?.title ?? '',
      questionPrompt: q?.prompt ?? '',
      questionPartLabel: q?.partLabel ?? null,
      audioUrl: rec.audioUrl,
      durationSeconds: rec.durationSeconds,
      note: rec.note,
      createdAt: rec.createdAt,
      author: {
        id: rec.userId,
        name: displayName(author),
        avatarUrl: author?.avatarUrl ?? null,
        isTeacher: rec.userId === course.teacherId || author?.role === 'admin'
      },
      isMine,
      canAssess: !isMine || access.teaches,
      canDelete: isMine || access.teaches,
      assessmentSummary: summarizeAssessments(recAssess),
      myAssessment: mine
        ? {
            overall: mine.overall,
            fluency: mine.fluency,
            vocabulary: mine.vocabulary,
            grammar: mine.grammar,
            pronunciation: mine.pronunciation
          }
        : null,
      commentsCount: recComments.length,
      comments: recComments
    }
  })

  return { items, total, page, limit, pages }
}

/** Saves an uploaded voice recording answering a speaking studio question. */
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

/** Submits or updates a peer/teacher assessment on a speaking studio recording. */
export async function upsertSpeakingAssessment(viewer: Viewer, recordingId: string, body: Record<string, unknown>) {
  const rec = await findSpeakingRecording(recordingId)
  const { access } = await requireSpeakingAccess(viewer, rec.courseId)
  if (rec.userId === viewer.id && !access.teaches) {
    throw createError({ statusCode: 400, message: 'You cannot assess your own recording' })
  }

  const values = {
    overall: rating(body.overall, true)!,
    fluency: rating(body.fluency, false),
    vocabulary: rating(body.vocabulary, false),
    grammar: rating(body.grammar, false),
    pronunciation: rating(body.pronunciation, false)
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
  return {
    assessmentSummary: summarizeAssessments(all),
    myAssessment: values
  }
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
