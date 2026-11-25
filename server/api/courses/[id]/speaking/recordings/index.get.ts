// Lists paginated speaking studio recordings in a course with peer assessments and comments.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)
  return listSpeakingRecordings(user, String(getRouterParam(event, 'id')), {
    questionId: typeof q.questionId === 'string' && q.questionId ? q.questionId : undefined,
    mine: q.mine === '1' || q.mine === 'true',
    page: Number(q.page) || 1,
    limit: Number(q.limit) || 10
  })
})
