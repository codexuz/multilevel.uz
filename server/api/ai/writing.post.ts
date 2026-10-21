import { eq } from 'drizzle-orm'
import { aiReviews, attempts } from '../../database/schema'

/**
 * Asks for AI feedback on Writing, either on a saved attempt ({ attemptId }) or on essays just
 * written in practice ({ slug, part?, essays: [{ taskId, text }] }). The prompts always come from
 * the test, never from the request. Returns the review to poll.
 */
interface Body { attemptId?: string, slug?: string, part?: number | string | null, essays?: { taskId: string, text: string }[] }

const MAX_WORDS = 1500

export default defineEventHandler(async (event) => {
  if (!aiEnabled()) throw createError({ statusCode: 404, message: 'AI feedback is not available' })
  const user = await requireUser(event)
  const body = (await readBody<Body>(event)) ?? {}
  const db = useDb()
  let tasks: AiTaskInput[]
  let testId: string | null
  let attemptId: string | null = null
  let attemptOwner: string | null = null

  if (body.attemptId) {
    const [attempt] = await db.select().from(attempts).where(eq(attempts.id, String(body.attemptId))).limit(1)
    if (!attempt || attempt.skill !== 'WRITING' || (attempt.userId !== user.id && !isStaffRole(user.role))) throw createError({ statusCode: 404, message: 'Writing not found' })
    const [existing] = await db.select({ id: aiReviews.id, status: aiReviews.status }).from(aiReviews).where(eq(aiReviews.attemptId, attempt.id)).limit(1)
    if (existing && existing.status !== 'FAILED') return { id: existing.id, status: existing.status }
    tasks = await attemptWritingTasks(attempt.id)
    testId = attempt.testId
    attemptId = attempt.id
    attemptOwner = attempt.userId
  } else {
    const test = await loadTest({ slug: String(body.slug ?? '') }, { publishedOnly: true })
    if (!(await canOpenTest(user, test, (await accessOf(user)).premium))) paymentRequired('PREMIUM_REQUIRED', 'This test is part of Premium')
    const whole = test.sections.find((s: any) => s.skill === 'WRITING')
    const section = whole && body.part ? pickPart(whole, Number(body.part)) : whole
    if (!section?.items?.length) throw createError({ statusCode: 404, message: 'Writing not found' })
    const given = new Map((Array.isArray(body.essays) ? body.essays : []).map(e => [String(e.taskId), String(e.text ?? '')]))
    tasks = section.items.filter((i: any) => i.writingTask).map((i: any) => {
      const t = i.writingTask
      const text = given.get(t.id) ?? ''
      return { taskId: t.id, taskNumber: t.taskNumber, label: taskLabel(t.taskNumber), prompt: t.prompt, minWords: minimumWordsFor(t.taskNumber, t.minWords), text, wordCount: countWords(text) }
    }).sort((a: AiTaskInput, b: AiTaskInput) => a.taskNumber - b.taskNumber)
    testId = test.id
  }

  if (!tasks.length || tasks.every(t => t.wordCount < 10)) throw createError({ statusCode: 400, message: 'Write at least a few sentences first.' })
  const long = tasks.find(t => t.wordCount > MAX_WORDS)
  if (long) throw createError({ statusCode: 400, message: `${long.label} is over ${MAX_WORDS} words. Shorten it to get feedback.` })

  // An examiner asking for a draft: the review is the candidate's, free, and not announced to them.
  const ownerId = attemptOwner && attemptOwner !== user.id ? attemptOwner : undefined
  const id = await startWritingReview(user, { attemptId, testId, tasks, ownerId, free: !!ownerId, notify: !ownerId })
  return { id, status: 'PENDING' }
})
