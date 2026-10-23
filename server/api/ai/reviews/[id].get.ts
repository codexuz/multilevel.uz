// One AI review, for its owner (or staff, or the attempt's marker): PENDING while it is being written, then the feedback.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const view = await aiReviewView(getRouterParam(event, 'id')!)
  if (!view || (view.userId !== user.id && !isStaffRole(user.role) && !(view.attemptId && await marksAttempt(user, view.attemptId)))) throw createError({ statusCode: 404, message: 'Not found' })
  return view
})
