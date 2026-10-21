// My exam plan: days left, each skill against my target, and this week's goals.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return planOf(user)
})
