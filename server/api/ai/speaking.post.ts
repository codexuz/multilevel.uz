import { eq } from 'drizzle-orm'
import { aiReviews, attempts } from '../../database/schema'

/**
 * Asks for AI feedback on Speaking, either on a saved attempt ({ attemptId }) or on answers just
 * recorded in practice ({ slug, part?, recordings: [{ partId, audioRef, durationSeconds }] }, the
 * recordings uploaded to our storage first). Questions come from the test; recordings are read
 * only from our own storage. Returns the review to poll.
 */
interface Body { attemptId?: string, slug?: string, part?: number | string | null, recordings?: { partId: string, audioRef: string, durationSeconds?: number }[] }

export default defineEventHandler(async (event) => {
  if (!aiEnabled()) throw createError({ statusCode: 404, message: 'AI feedback is not available' })
  const user = await requireUser(event)
  const body = (await readBody<Body>(event)) ?? {}
  const db = useDb()
  let parts: AiSpeakingPart[]
  let testId: string | null
  let attemptId: string | null = null
  let ownerId: string | undefined

  if (body.attemptId) {
    const [attempt] = await db.select().from(attempts).where(eq(attempts.id, String(body.attemptId))).limit(1)
    if (!attempt || attempt.skill !== 'SPEAKING' || (attempt.userId !== user.id && !isStaffRole(user.role))) throw createError({ statusCode: 404, message: 'Speaking not found' })
    const [existing] = await db.select({ id: aiReviews.id, status: aiReviews.status }).from(aiReviews).where(eq(aiReviews.attemptId, attempt.id)).limit(1)
    if (existing && existing.status !== 'FAILED') return { id: existing.id, status: existing.status }
    parts = await attemptSpeakingParts(attempt.id)
    testId = attempt.testId
    attemptId = attempt.id
    if (attempt.userId !== user.id) ownerId = attempt.userId
  } else {
    const test = await loadTest({ slug: String(body.slug ?? '') }, { publishedOnly: true })
    if (!(await canOpenTest(user, test, (await accessOf(user)).premium))) paymentRequired('PREMIUM_REQUIRED', 'This test is part of Premium')
    const whole = test.sections.find((s: any) => s.skill === 'SPEAKING')
    const section = whole && body.part ? pickPart(whole, Number(body.part)) : whole
    if (!section?.items?.length) throw createError({ statusCode: 404, message: 'Speaking not found' })
    const given = new Map((Array.isArray(body.recordings) ? body.recordings : []).map(r => [String(r.partId), r]))
    const items = section.items.filter((i: any) => i.speakingPart && given.has(i.speakingPart.id)).map((i: any) => {
      const r = given.get(i.speakingPart.id)!
      // Only this user's own uploads (their user id is part of a recording's key).
      const key = s3KeyFromUrl(String(r.audioRef))
      if (!key || !key.split('/').includes(user.id)) throw createError({ statusCode: 400, message: 'Upload the recordings first' })
      return { part: i.speakingPart, audioRef: String(r.audioRef), durationSeconds: Number(r.durationSeconds) || null }
    })
    parts = await withQuestions(items)
    testId = test.id
  }
  if (!parts.length) throw createError({ statusCode: 400, message: 'Record at least one answer first.' })

  const id = await startWritingReview(user, { attemptId, testId, tasks: parts, skill: 'SPEAKING', ownerId, free: !!ownerId, notify: !ownerId })
  return { id, status: 'PENDING' }
})
