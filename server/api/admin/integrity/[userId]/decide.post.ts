// The admin's decision: CLEAR, WARN (with a message sent to them) or DISQUALIFY (off a live mock's board).
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<{ action?: string, attemptIds?: string[], note?: string, message?: string }>(event)) ?? {}
  if (body.action !== 'CLEAR' && body.action !== 'WARN' && body.action !== 'DISQUALIFY') throw createError({ statusCode: 400, message: 'Pick what to do' })
  return decide(admin.id, String(getRouterParam(event, 'userId')), { action: body.action, attemptIds: Array.isArray(body.attemptIds) ? body.attemptIds.map(String) : undefined, note: body.note, message: body.message })
})
