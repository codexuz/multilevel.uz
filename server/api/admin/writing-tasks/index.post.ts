export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  return createWritingTask(await readBody(event), user.id)
})
