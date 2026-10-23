import { and, eq, sql } from 'drizzle-orm'
import { answers, attempts, essays, speakingResponses, users } from '../../../../database/schema'

/**
 * Handing in one section, signed in. Listening and Reading are marked at once; Writing and
 * Speaking go to an examiner, for one marking credit. The attempt is saved and its result
 * returned. Explanations in the review come with Premium.
 */
interface SubmitBody {
  answers?: { itemId: string, answer: string }[]
  essays?: { taskId: string, text: string }[]
  recordings?: { partId: string, position?: number, audioRef: string, durationSeconds?: number }[]
  startedAt?: string
  /** At a mock seat: what the exam page saw while it was sat (see integrity.ts). */
  integrity?: unknown
}

export default defineEventHandler(async (event) => {
  const skill = String(getRouterParam(event, 'skill')).toUpperCase()
  if (!isSkill(skill)) throw createError({ statusCode: 404, message: 'Section not found' })
  const test = await loadTest({ slug: getRouterParam(event, 'slug')! }, { publishedOnly: true })
  const whole = test.sections.find((s: any) => s.skill === skill)
  if (!whole?.items?.length) throw createError({ statusCode: 404, message: 'Section not found' })
  // ?part=N: one part practised on its own, marked and saved as that part.
  const partNumber = getQuery(event).part ? Number(getQuery(event).part) : null
  const section = partNumber ? pickPart(whole, partNumber) : whole
  if (!section) throw createError({ statusCode: 404, message: 'Part not found' })

  const body = (await readBody<SubmitBody>(event)) ?? {}
  // Only a signed-in candidate sits a test (guests may look at tests, not take them).
  const user = await requireUser(event)
  const access = await accessOf(user)
  // At a mock session's seat: the section the invigilator opened, paid for by the session.
  const seat = await seatGate(user.id, test.id, skill, partNumber)
  if (!seat && !(await canOpenTest(user, test, access.premium, partNumber ? section.items[0]?.id : null))) paymentRequired('PREMIUM_REQUIRED', 'This test is part of Premium')

  // Only this section's questions and tasks count; anything else in the body is ignored.
  const ids = itemIdsOf(section)
  const given = new Map<string, string>()
  for (const a of Array.isArray(body.answers) ? body.answers : []) {
    if (a && ids.has(a.itemId) && typeof a.answer === 'string') given.set(a.itemId, a.answer.slice(0, 500))
  }
  const taskIds = new Set(section.items.filter((i: any) => i.writingTask).map((i: any) => i.writingTask.id))
  const essayMap = new Map<string, { text: string, wordCount: number }>()
  for (const e of Array.isArray(body.essays) ? body.essays : []) {
    if (e && taskIds.has(e.taskId) && typeof e.text === 'string') essayMap.set(e.taskId, { text: e.text.slice(0, 20000), wordCount: countEssayWords(e.text) })
  }
  // One recording per turn of the exam (a question of Part 1.1 or 1.2, or all of Part 2 or Part 3),
  // each the candidate's own upload to our storage.
  const turns = new Set(speakingSteps(section.items.filter((i: any) => i.speakingPart).map((i: any) => i.speakingPart)).map(s => `${s.partId}:${s.position}`))
  const recorded = new Map<string, { partId: string, position: number, audioRef: string, durationSeconds: number | null }>()
  for (const r of Array.isArray(body.recordings) ? body.recordings : []) {
    const position = Math.max(0, Math.floor(Number(r?.position) || 0))
    const key = s3KeyFromUrl(String(r?.audioRef ?? ''))
    if (!r || !turns.has(`${r.partId}:${position}`) || !key || (user && !key.split('/').includes(user.id))) continue
    recorded.set(`${r.partId}:${position}`, { partId: r.partId, position, audioRef: r.audioRef, durationSeconds: Number.isFinite(Number(r.durationSeconds)) ? Math.round(Number(r.durationSeconds)) : null })
  }
  const recordings = [...recorded.values()]

  const objective = skill === 'LISTENING' || skill === 'READING'
  const marked = markSection(section, given, test.module)
  const startedAt = body.startedAt && !Number.isNaN(Date.parse(body.startedAt)) ? new Date(body.startedAt) : null
  // At a seat, what the exam page saw is kept for the invigilator; practice and live mocks keep nothing.
  const seconds = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : null
  const integrity = seat ? integrityValues(skill, cleanSignals(body.integrity), { seconds, marked: objective ? { correct: marked.correct, total: marked.total } : null }) : {}

  let liveMockId: string | null = null
  if (skill === 'SPEAKING' && !recordings.length) throw createError({ statusCode: 400, message: 'Record at least one answer before handing in' })
  // An examiner's time is what a marking credit pays for; staff hand in freely, and so do students
  // of a centre whose licence runs: their own teachers mark them (markers.ts).
  const byTeacher = !seat && !objective && await studiesAtCentre(user.id)
  const needsCredit = !seat && !objective && !byTeacher && !isStaffRole(user.role)
  if (needsCredit && access.credits < 1) paymentRequired('CREDIT_REQUIRED', 'Marking by an examiner needs a marking credit')
  const db = useDb()
  // A whole section sat during a live mock of this test counts there, the first one of each skill.
  const mock = partNumber || seat ? null : await openMockOfTest(test.id)
  const attemptId = await db.transaction(async (tx) => {
    if (needsCredit && !(await holdCredits(tx, user.id))) paymentRequired('CREDIT_REQUIRED', 'Marking by an examiner needs a marking credit')
    if (mock) {
      await tx.execute(sql`select 1 from ${users} where ${users.id} = ${user.id} for update`)
      const [before] = await tx.select({ id: attempts.id }).from(attempts)
        .where(and(eq(attempts.liveMockId, mock.id), eq(attempts.userId, user.id), eq(attempts.skill, skill))).limit(1)
      if (!before) liveMockId = mock.id
    }
    const [attempt] = await tx.insert(attempts).values({
      userId: user.id, testId: test.id, sectionId: section.id, skill, partNumber, mode: test.mode,
      status: objective ? 'GRADED' : 'SUBMITTED', startedAt, gradedAt: objective ? new Date() : null,
      correct: objective ? marked.correct : null, total: objective ? marked.total : null, exam: marked.exam,
      score: objective ? marked.score : null, band: objective ? marked.band : null, cefrLevel: objective ? marked.cefrLevel : null, liveMockId,
      mockCandidateId: seat?.id ?? null,
      ...integrity
    }).returning({ id: attempts.id })
    const rows = [...ids].filter(id => given.has(id)).map(itemId => ({ attemptId: attempt!.id, itemId, response: given.get(itemId)!, isCorrect: marked.marks.get(itemId) ?? false }))
    if (rows.length) await tx.insert(answers).values(rows)
    const essayRows = [...essayMap.entries()].map(([taskId, e]) => ({ attemptId: attempt!.id, taskId, text: e.text, wordCount: e.wordCount }))
    if (essayRows.length) await tx.insert(essays).values(essayRows)
    if (recordings.length) await tx.insert(speakingResponses).values(recordings.map(r => ({ attemptId: attempt!.id, ...r })))
    if (needsCredit) await spendCredit(tx, user.id, attempt!.id)
    return attempt!.id
  })
  // A friend's invite pays off once they finish a test.
  if (!seat) await rewardInviter(user.id).catch(e => console.error('[rewards] inviter reward failed:', e))
  // Writing for an examiner: an AI estimate for the candidate now, and a draft for the examiner.
  if (byTeacher) await tellTeachersToMark({ id: attemptId, userId: user.id, skill }).catch(e => console.error('[marking] teachers not told:', e))
  if (skill === 'WRITING') await reviewHandedInWriting({ id: attemptId, userId: user.id, testId: test.id }, getCookie(event, 'lang')).catch(e => console.error('[ai-writing] auto review failed:', e))
  if (skill === 'SPEAKING') await reviewHandedInSpeaking({ id: attemptId, userId: user.id, testId: test.id }, getCookie(event, 'lang')).catch(e => console.error('[ai-speaking] auto review failed:', e))

  return {
    id: attemptId,
    saved: !!attemptId,
    liveMockId,
    skill,
    partNumber,
    status: objective ? 'GRADED' : attemptId ? 'SUBMITTED' : 'PRACTICE',
    test: { id: test.id, slug: test.slug, title: test.title },
    submittedAt: new Date(),
    correct: objective ? marked.correct : null,
    total: objective ? marked.total : null,
    exam: marked.exam,
    score: objective ? marked.score : null,
    band: objective ? marked.band : null,
    cefrLevel: objective ? marked.cefrLevel : null,
    review: {
      sections: [reviewSection(section, {
        explanations: access.premium,
        given, marks: marked.marks,
        correct: objective ? marked.correct : null, total: objective ? marked.total : null, score: objective ? marked.score : null, band: objective ? marked.band : null,
        essays: essayMap
      })]
    }
  }
})
