// Lists paginated speaking recordings in a course (optionally scoped to exerciseId, lessonId, or questionId).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)
  return listSpeakingRecordings(user, String(getRouterParam(event, 'id')), {
    questionId: typeof q.questionId === 'string' && q.questionId ? q.questionId : undefined,
    exerciseId: typeof q.exerciseId === 'string' && q.exerciseId ? q.exerciseId : undefined,
    lessonId: typeof q.lessonId === 'string' && q.lessonId ? q.lessonId : undefined,
    mine: q.mine === '1' || q.mine === 'true',
    page: Number(q.page) || 1,
    limit: Number(q.limit) || 10
  })
})
