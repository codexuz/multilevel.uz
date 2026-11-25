// How many people a broadcast would reach: ?role=ALL|STUDENTS|TEACHERS&exam=ANY|IELTS|MULTILEVEL&locale=ANY|uz|ru|en.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { count: await countAudience(broadcastAudience(getQuery(event))) }
})
