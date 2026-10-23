import { inArray } from 'drizzle-orm'
import { speakingParts } from '../../../database/schema'

const MAX_PARTS = 300
const LONG_TURN = (exam: string, n: number) => (exam === 'IELTS' ? n === 2 : n >= 3)

/**
 * Speaking parts from a file (format "mockmee/speaking-parts", or just the list): each with its
 * questions, the examiner's audio and sample answers. A part with an `id` of this site is updated
 * (an export, filled in and brought back); the rest are made new. Everything is checked first and
 * nothing is saved if anything is wrong; ?dryRun=1 only checks.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readBody<any>(event)
  const list: any[] = Array.isArray(body) ? body : Array.isArray(body?.parts) ? body.parts : []
  if (!list.length) throw createError({ statusCode: 400, message: 'The file has no Speaking parts ("parts": [...])' })
  if (list.length > MAX_PARTS) throw createError({ statusCode: 400, message: `At most ${MAX_PARTS} parts at a time` })
  const fallbackExam = body?.exam === 'IELTS' ? 'IELTS' : 'MULTILEVEL'

  const ids = list.map(p => p?.id).filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))
  const known = new Map((ids.length ? await useDb().select({ id: speakingParts.id, exam: speakingParts.exam }).from(speakingParts).where(inArray(speakingParts.id, ids)) : []).map(r => [r.id, r.exam]))

  const errors: { index: number, message: string }[] = []
  const plan = list.map((raw, index) => {
    const where = `Part ${index + 1}${raw?.title ? ` (${raw.title})` : ''}`
    try {
      if (!raw || typeof raw !== 'object') throw new Error('not a part')
      const id = typeof raw.id === 'string' && known.has(raw.id) ? raw.id : null
      if (raw.id && !id) throw new Error(`no Speaking part here has the id ${raw.id}`)
      const exam = id ? known.get(id)! : raw.exam === 'IELTS' || raw.exam === 'MULTILEVEL' ? raw.exam : fallbackExam
      const partNumber = Number(raw.partNumber)
      if (!partNumbersOf(exam, 'SPEAKING').includes(partNumber)) throw new Error(`partNumber must be one of ${partNumbersOf(exam, 'SPEAKING').join(', ')} for ${exam}`)
      const questions = speakingQuestionsOf(raw.questions, where)
      const extras = partExtrasOf(raw, where)
      const cueCard = typeof raw.cueCard === 'string' && raw.cueCard.trim() ? raw.cueCard : null
      if (LONG_TURN(exam, partNumber) ? !cueCard && !questions.length : !questions.length) throw new Error(LONG_TURN(exam, partNumber) ? 'a long turn needs a cueCard' : 'it needs at least one question')
      return {
        id, exam, partNumber, questions: questions.length, audio: questions.filter(q => q.audioRef).length + (extras.audioRef ? 1 : 0),
        samples: questions.filter(q => q.sampleAnswer).length + (extras.sampleAnswer ? 1 : 0),
        body: { ...raw, exam, partNumber, cueCard, imageRef: raw.imageRef ?? raw.imageUrl ?? null, ...extras, questions }
      }
    } catch (e: any) {
      const message = String(e?.message ?? e)
      errors.push({ index, message: message.startsWith(where) ? message : `${where}: ${message}` })
      return null
    }
  })
  const summary = {
    parts: list.length,
    created: plan.filter(p => p && !p.id).length,
    updated: plan.filter(p => p?.id).length,
    questions: plan.reduce((n, p) => n + (p?.questions ?? 0), 0),
    audio: plan.reduce((n, p) => n + (p?.audio ?? 0), 0),
    samples: plan.reduce((n, p) => n + (p?.samples ?? 0), 0),
    errors
  }
  if (errors.length || getQuery(event).dryRun) return { ...summary, saved: false }

  const saved: string[] = []
  for (const p of plan) saved.push((await saveSpeakingPart(p!.id, p!.body, user.id)).id)
  return { ...summary, saved: true, ids: saved }
})
