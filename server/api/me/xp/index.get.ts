// My XP: today against my daily goal, my streak, the last seven days, my total and level.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await xpSummary(user.id)
})
