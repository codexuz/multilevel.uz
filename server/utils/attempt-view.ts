import { eq } from 'drizzle-orm'
import { answers, attempts, essays, speakingResponses, users } from '../database/schema'
import { SECTION_WITH } from './content'

/** An attempt as a list shows it. */
export function attemptSummary(row: any) {
  return {
    id: row.id,
    skill: row.skill,
    mode: row.mode,
    status: row.status,
    test: row.test ? { id: row.test.id, slug: row.test.slug, title: row.test.title } : null,
    user: row.user ? { id: row.user.id, name: row.user.name ?? row.user.email, avatarUrl: row.user.avatarUrl } : undefined,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
    gradedAt: row.gradedAt,
    durationSeconds: row.startedAt ? Math.max(0, Math.round((new Date(row.submittedAt).getTime() - new Date(row.startedAt).getTime()) / 1000)) : null,
    correct: row.correct,
    total: row.total,
    score: row.score,
    cefrLevel: row.cefrLevel,
    feedback: row.feedback
  }
}

/** A saved attempt with its marked review: keys, answers given, essays, recordings and the examiner's word. */
export async function attemptView(id: string, viewer: { id: string, role: string }) {
  const db = useDb()
  const row = await db.query.attempts.findFirst({ where: eq(attempts.id, id), with: { test: true, user: true } })
  if (!row) throw createError({ statusCode: 404, message: 'Attempt not found' })
  const staff = viewer.role === 'admin' || viewer.role === 'examiner'
  if (row.userId !== viewer.id && !staff) throw createError({ statusCode: 404, message: 'Attempt not found' })

  const section = row.sectionId ? await db.query.sections.findFirst({ where: (s, { eq: e }) => e(s.id, row.sectionId!), with: SECTION_WITH as any }) as any : null
  const [given, written, recorded] = await Promise.all([
    db.select().from(answers).where(eq(answers.attemptId, id)),
    db.select().from(essays).where(eq(essays.attemptId, id)),
    db.select().from(speakingResponses).where(eq(speakingResponses.attemptId, id))
  ])
  const examiner = row.examinerId ? (await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, row.examinerId)).limit(1))[0] : null
  // Explanations follow the owner's Premium (staff always see them).
  const explanations = staff || (await accessOf({ id: row.userId, role: row.user?.role ?? 'student' })).premium
  const review = section
    ? reviewSection(section, {
        explanations,
        given: new Map(given.map(a => [a.itemId, a.response ?? ''])),
        marks: new Map(given.map(a => [a.itemId, !!a.isCorrect])),
        correct: row.correct, total: row.total, score: row.score,
        essays: new Map(written.map(e => [e.taskId, { id: e.id, text: e.text, wordCount: e.wordCount, feedback: e.feedback }]))
      })
    : null
  return {
    ...attemptSummary(row),
    saved: true,
    examiner: examiner ? { name: examiner.name ?? examiner.email } : null,
    recordings: recorded.map(r => ({ partId: r.partId, audioUrl: r.audioRef, durationSeconds: r.durationSeconds })),
    review: review ? { sections: [review] } : null
  }
}
