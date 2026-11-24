// Renames or moves an online class (its Calendar event follows): { title?, description?, startsAt?, durationMinutes? }.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const row = await requireLiveLesson(user, String(getRouterParam(event, 'id')))
  return liveView(await updateLiveLesson(row, (await readBody(event)) ?? {}), true)
})
