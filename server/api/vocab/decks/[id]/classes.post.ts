// Sets the classes a deck is studied in: { groupIds: [...] } (the teacher's own classes).
export default defineEventHandler(async (event) => {
  const { deck, user } = await requireDeckTeacher(event, String(getRouterParam(event, 'id')))
  const ids = (await readBody<{ groupIds?: unknown }>(event))?.groupIds
  return { classIds: await setDeckClasses(deck, deck.teacherId ?? user.id, Array.isArray(ids) ? ids.map(String) : []) }
})
