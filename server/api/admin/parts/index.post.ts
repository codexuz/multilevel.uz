export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  return createPart(await readBody(event), user.id)
})
