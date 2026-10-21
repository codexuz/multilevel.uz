// For admins: runs a background job now instead of waiting for its time.
const TASKS = ['reminders:premium', 'reminders:plan']

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const name = String(getRouterParam(event, 'name'))
  if (!TASKS.includes(name)) throw createError({ statusCode: 404, message: 'No such task' })
  return runTask(name)
})
