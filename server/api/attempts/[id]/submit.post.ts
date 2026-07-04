import type { Json } from '~/types/database.types'

interface QuestionRow { id: string, type: string, correct_answer: Json, points: number }
interface AnswerRow { id: string, question_id: string, response: Json }

// Submits an attempt. Objective sections (listening/reading) are auto-graded with
// the correct answers, which live only on the server (service role). Writing and
// speaking are marked 'submitted' for examiner grading.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const attemptId = getRouterParam(event, 'id')
  if (!attemptId) throw createError({ statusCode: 400, message: 'attempt id required' })

  const supabase = serviceClient(event)

  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, user_id, section_id, status, max_score, sections(type)')
    .eq('id', attemptId)
    .single()
  if (!attempt) throw createError({ statusCode: 404, message: 'Attempt not found' })

  const a = attempt as unknown as { user_id: string, section_id: string, status: string, max_score: number | null, sections: { type: string } }
  if (a.user_id !== user.id) throw createError({ statusCode: 403, message: 'Forbidden' })
  if (a.status !== 'in_progress') throw createError({ statusCode: 409, message: 'Attempt already submitted' })

  const sectionType = a.sections.type
  const objective = sectionType === 'listening' || sectionType === 'reading'
  const now = new Date().toISOString()

  if (objective) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id, type, correct_answer, points, parts!inner(section_id)')
      .eq('parts.section_id', a.section_id)
    const { data: answers } = await supabase
      .from('answers')
      .select('id, question_id, response')
      .eq('attempt_id', attemptId)

    const qList = (questions as unknown as QuestionRow[]) ?? []
    const aList = (answers as unknown as AnswerRow[]) ?? []
    const answerByQ = new Map(aList.map(x => [x.question_id, x]))

    let score = 0
    let maxScore = 0
    for (const q of qList) {
      maxScore += Number(q.points || 0)
      const ans = answerByQ.get(q.id)
      const correct = ans ? gradeQuestion(q.type, q.correct_answer, ans.response) : false
      const awarded = correct ? Number(q.points || 0) : 0
      score += awarded
      if (ans) {
        await supabase.from('answers').update({ is_correct: correct, awarded_points: awarded }).eq('id', ans.id)
      }
    }

    await supabase.from('attempts').update({
      status: 'graded',
      submitted_at: now,
      auto_score: score,
      total_score: score,
      max_score: maxScore
    }).eq('id', attemptId)

    return { status: 'graded', score, maxScore }
  }

  // Writing / Speaking → await examiner
  await supabase.from('attempts').update({ status: 'submitted', submitted_at: now }).eq('id', attemptId)
  return { status: 'submitted' }
})
