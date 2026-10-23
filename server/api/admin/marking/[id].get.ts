// A Writing or Speaking attempt as its marker marks it: the tasks, the essays, the recordings.
export default defineEventHandler(async (event) => {
  const { user, scope } = await requireMarker(event)
  const id = getRouterParam(event, 'id')!
  await requireMarkable(scope, id)
  return attemptView(id, user, { marker: true })
})
