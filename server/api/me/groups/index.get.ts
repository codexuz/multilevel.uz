// My groups (classes I am a student in), with what is waiting in each.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { groups: await studentGroups(user.id) }
})
