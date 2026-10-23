import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { speakingParts } from '../../../database/schema'

/**
 * The Speaking library as a file ("mockmee/speaking-parts"), ?exam=, ?partNumber= or ?ids=a,b: each
 * part with its id, questions, examiner audio and sample answers. Filled in and imported again, it
 * updates the same parts.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const ids = String(query.ids ?? '').split(',').filter(id => /^[0-9a-f-]{36}$/i.test(id))
  const rows = await useDb().query.speakingParts.findMany({
    where: and(
      query.exam === 'IELTS' || query.exam === 'MULTILEVEL' ? eq(speakingParts.exam, query.exam) : undefined,
      query.partNumber ? eq(speakingParts.partNumber, Number(query.partNumber)) : undefined,
      ids.length ? inArray(speakingParts.id, ids) : undefined
    ),
    orderBy: [asc(speakingParts.exam), asc(speakingParts.partNumber), desc(speakingParts.updatedAt)],
    with: { questions: { orderBy: (t, { asc: a }) => [a(t.position)] } },
    limit: 2000
  })
  setHeader(event, 'Content-Disposition', `attachment; filename="speaking-parts-${new Date().toISOString().slice(0, 10)}.json"`)
  return {
    format: SPEAKING_FILE_FORMAT,
    version: 1,
    exportedAt: new Date(),
    parts: rows.map(p => ({
      id: p.id, exam: p.exam, partNumber: p.partNumber, title: p.title, cueCard: p.cueCard, imageUrl: p.imageRef,
      audioUrl: p.audioRef, sampleAnswer: p.sampleAnswer, prepSeconds: p.prepSeconds, speakSeconds: p.speakSeconds,
      questions: p.questions.map(q => ({ text: q.text, audioUrl: q.audioRef, sampleAnswer: q.sampleAnswer }))
    }))
  }
})
