// Cancels an online class: off the teacher's calendar, and its students told.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const row = await requireLiveLesson(user, String(getRouterParam(event, 'id')))
  return liveView(await cancelLiveLesson(row), true)
})
