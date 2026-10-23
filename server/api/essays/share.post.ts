// Shows one of the user's essays, unnamed, as a sample on its task's public page, or stops.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = (await readBody<{ attemptId?: string, taskId?: string, share?: boolean }>(event)) ?? {}
  return shareEssay(user.id, String(body.attemptId ?? ''), String(body.taskId ?? ''), !!body.share)
})
