export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  return createTest(await readBody(event), user.id)
})
