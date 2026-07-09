import { asc, eq, inArray } from 'drizzle-orm'
import { tests, sections, parts, questions, attempts, answers, users } from '../schema'
import { num } from '../../utils/serialize'

type Db = ReturnType<typeof useDb>

/** Full admin test tree (sections → parts → questions, incl. correctAnswer). */
export async function getTestTree(db: Db, testId: string) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId)).limit(1)
  if (!test) return null

  const secs = await db.select().from(sections)
    .where(eq(sections.testId, testId)).orderBy(asc(sections.orderIndex))
  const secIds = secs.map(s => s.id)
  const partRows = secIds.length
    ? await db.select().from(parts).where(inArray(parts.sectionId, secIds)).orderBy(asc(parts.orderIndex))
    : []
  const partIds = partRows.map(p => p.id)
  const qRows = partIds.length
    ? await db.select().from(questions).where(inArray(questions.partId, partIds)).orderBy(asc(questions.orderIndex))
    : []

  const qByPart = new Map<string, typeof qRows>()
  for (const q of qRows) {
    const list = qByPart.get(q.partId) ?? []
    list.push(q)
    qByPart.set(q.partId, list)
  }
  const partsBySection = new Map<string, typeof partRows>()
  for (const p of partRows) {
    const list = partsBySection.get(p.sectionId) ?? []
    list.push(p)
    partsBySection.set(p.sectionId, list)
  }

  return {
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      level: test.level,
      status: test.status,
      isPremium: test.isPremium
    },
    sections: secs.map(s => ({
      id: s.id,
      type: s.type,
      title: s.title,
      durationMinutes: s.durationMinutes,
      orderIndex: s.orderIndex,
      audioUrl: s.audioUrl,
      videoExplanationUrl: s.videoExplanationUrl,
      parts: (partsBySection.get(s.id) ?? []).map(p => ({
        id: p.id,
        title: p.title,
        instructions: p.instructions,
        content: p.content,
        audioUrl: p.audioUrl,
        imageUrl: p.imageUrl,
        orderIndex: p.orderIndex,
        questions: (qByPart.get(p.id) ?? []).map(q => ({
          id: q.id,
          type: q.type,
          questionNumber: q.questionNumber,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: num(q.points) ?? 0,
          meta: q.meta,
          orderIndex: q.orderIndex
        }))
      }))
    }))
  }
}

/** Attempt with its section/part/question/answer detail for grading. */
export async function getGradingDetail(db: Db, attemptId: string) {
  const [att] = await db.select({
    id: attempts.id,
    userId: attempts.userId,
    sectionId: attempts.sectionId,
    status: attempts.status,
    feedback: attempts.feedback,
    submittedAt: attempts.submittedAt,
    sectionType: sections.type,
    sectionTitle: sections.title,
    testTitle: tests.title,
    studentName: users.name
  }).from(attempts)
    .innerJoin(sections, eq(attempts.sectionId, sections.id))
    .innerJoin(tests, eq(attempts.testId, tests.id))
    .innerJoin(users, eq(attempts.userId, users.id))
    .where(eq(attempts.id, attemptId)).limit(1)
  if (!att) return null

  const partRows = await db.select({ id: parts.id }).from(parts)
    .where(eq(parts.sectionId, att.sectionId)).orderBy(asc(parts.orderIndex))
  const partIds = partRows.map(p => p.id)
  const qRows = partIds.length
    ? await db.select().from(questions).where(inArray(questions.partId, partIds)).orderBy(asc(questions.orderIndex))
    : []
  const ansRows = await db.select().from(answers).where(eq(answers.attemptId, attemptId))

  return {
    attempt: att,
    questions: qRows.map(q => ({
      id: q.id,
      type: q.type,
      questionNumber: q.questionNumber,
      prompt: q.prompt,
      points: num(q.points) ?? 0,
      meta: q.meta
    })),
    answers: ansRows.map(a => ({
      id: a.id,
      questionId: a.questionId,
      response: a.response,
      audioUrl: a.audioUrl,
      awardedPoints: num(a.awardedPoints)
    }))
  }
}
