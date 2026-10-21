// My weak spots and progress, with a part to practise for each.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return insightsOf(user)
})
