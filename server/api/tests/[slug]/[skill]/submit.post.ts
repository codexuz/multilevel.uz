import { answers, attempts, essays, speakingResponses } from '../../../../database/schema'

/**
 * Handing in one section. Listening and Reading are marked at once for everybody; Writing and
 * Speaking are not marked here. A signed-in candidate's attempt is saved (Writing and Speaking go
 * to an examiner, for one marking credit); a guest's answers are checked and the result is returned,
 * nothing is stored. Explanations in the review come with Premium.
 */
interface SubmitBody {
  answers?: { itemId: string, answer: string }[]
  essays?: { taskId: string, text: string }[]
  recordings?: { partId: string, audioRef: string, durationSeconds?: number }[]
  startedAt?: string
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
  const user = await optionalUser(event)
  const access = await accessOf(user)
  if (!(await canOpenTest(user, test, access.premium))) paymentRequired('PREMIUM_REQUIRED', 'This test is part of Premium')

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
  const speakingIds = new Set(section.items.filter((i: any) => i.speakingPart).map((i: any) => i.speakingPart.id))
  const recordings = (Array.isArray(body.recordings) ? body.recordings : [])
    .filter(r => r && speakingIds.has(r.partId) && typeof r.audioRef === 'string' && /^https?:\/\//.test(r.audioRef))

  const objective = skill === 'LISTENING' || skill === 'READING'
  const marked = markSection(section, given)
  const startedAt = body.startedAt && !Number.isNaN(Date.parse(body.startedAt)) ? new Date(body.startedAt) : null

  let attemptId: string | null = null
  if (user) {
    if (skill === 'SPEAKING' && !recordings.length) throw createError({ statusCode: 400, message: 'Record at least one answer before handing in' })
    // An examiner's time is what a marking credit pays for; staff hand in freely.
    const needsCredit = !objective && !isStaffRole(user.role)
    if (needsCredit && access.credits < 1) paymentRequired('CREDIT_REQUIRED', 'Marking by an examiner needs a marking credit')
    const db = useDb()
    attemptId = await db.transaction(async (tx) => {
      if (needsCredit && !(await holdCredits(tx, user.id))) paymentRequired('CREDIT_REQUIRED', 'Marking by an examiner needs a marking credit')
      const [attempt] = await tx.insert(attempts).values({
        userId: user.id, testId: test.id, sectionId: section.id, skill, partNumber, mode: test.mode,
        status: objective ? 'GRADED' : 'SUBMITTED', startedAt, gradedAt: objective ? new Date() : null,
        correct: objective ? marked.correct : null, total: objective ? marked.total : null,
        score: objective ? marked.score : null, cefrLevel: objective ? marked.cefrLevel : null
      }).returning({ id: attempts.id })
      const rows = [...ids].filter(id => given.has(id)).map(itemId => ({ attemptId: attempt!.id, itemId, response: given.get(itemId)!, isCorrect: marked.marks.get(itemId) ?? false }))
      if (rows.length) await tx.insert(answers).values(rows)
      const essayRows = [...essayMap.entries()].map(([taskId, e]) => ({ attemptId: attempt!.id, taskId, text: e.text, wordCount: e.wordCount }))
      if (essayRows.length) await tx.insert(essays).values(essayRows)
      if (recordings.length) await tx.insert(speakingResponses).values(recordings.map(r => ({ attemptId: attempt!.id, partId: r.partId, audioRef: r.audioRef, durationSeconds: r.durationSeconds ?? null })))
      if (needsCredit) await spendCredit(tx, user.id, attempt!.id)
      return attempt!.id
    })
    // A friend's invite pays off once they finish a test.
    await rewardInviter(user.id).catch(e => console.error('[rewards] inviter reward failed:', e))
    // Writing for an examiner: an AI estimate for the candidate now, and a draft for the examiner.
    if (skill === 'WRITING') await reviewHandedInWriting({ id: attemptId!, userId: user.id, testId: test.id }).catch(e => console.error('[ai-writing] auto review failed:', e))
    if (skill === 'SPEAKING') await reviewHandedInSpeaking({ id: attemptId!, userId: user.id, testId: test.id }).catch(e => console.error('[ai-speaking] auto review failed:', e))
  }

  return {
    id: attemptId,
    saved: !!attemptId,
    skill,
    partNumber,
    status: objective ? 'GRADED' : attemptId ? 'SUBMITTED' : 'PRACTICE',
    test: { id: test.id, slug: test.slug, title: test.title },
    submittedAt: new Date(),
    correct: objective ? marked.correct : null,
    total: objective ? marked.total : null,
    score: objective ? marked.score : null,
    cefrLevel: objective ? marked.cefrLevel : null,
    review: {
      sections: [reviewSection(section, {
        explanations: access.premium,
        given, marks: marked.marks,
        correct: objective ? marked.correct : null, total: objective ? marked.total : null, score: objective ? marked.score : null,
        essays: essayMap
      })]
    }
  }
})
