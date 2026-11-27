export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const id = getRouterParam(event, 'id')!
  const body = (await readBody<{ groupIds?: string[], studentIds?: string[] }>(event)) ?? {}
  return setTestAudience(
    user,
    id,
    Array.isArray(body.groupIds) ? body.groupIds : [],
    Array.isArray(body.studentIds) ? body.studentIds : []
  )
})
