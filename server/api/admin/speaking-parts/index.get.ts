export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listSpeakingParts(getQuery(event))
})
