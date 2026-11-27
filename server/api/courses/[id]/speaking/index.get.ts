// Fetches a course's Speaking Studio overview (optionally scoped to an exerciseId or lessonId).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const q = getQuery(event)
  return speakingStudioOverview(user, String(getRouterParam(event, 'id')), {
    exerciseId: typeof q.exerciseId === 'string' && q.exerciseId ? q.exerciseId : undefined,
    lessonId: typeof q.lessonId === 'string' && q.lessonId ? q.lessonId : undefined
  })
})
