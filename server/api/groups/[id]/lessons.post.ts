// A new online class for the class, on Google Meet: { title, description?, startsAt, durationMinutes }.
export default defineEventHandler(async (event) => {
  const { group } = await requireClassTeacher(event, String(getRouterParam(event, 'id')))
  const row = await createLiveLesson(group.teacherId, { groupId: group.id }, (await readBody(event)) ?? {})
  return liveView(row, true)
})
