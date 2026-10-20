export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  return saveSpeakingPart(null, await readBody(event), user.id)
})
