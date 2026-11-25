// A class's vocabulary (its teacher): its decks and each student's progress in them, with their week's XP.
export default defineEventHandler(async (event) => {
  const groupId = String(getRouterParam(event, 'id'))
  await requireClassTeacher(event, groupId)
  return await classVocabulary(groupId)
})
