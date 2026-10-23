// The AI writes the explanations (and quotes the evidence) a Listening or Reading part's questions
// lack, or all of them with { overwrite: true }, and saves them (ai-explain.ts).
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  if (!aiEnabled()) throw createError({ statusCode: 404, message: 'AI is not set up' })
  const id = getRouterParam(event, 'id')!
  const body = (await readBody<{ overwrite?: boolean }>(event)) ?? {}
  const { filled } = await explainPart(id, { overwrite: !!body.overwrite, userId: admin.id })
  return { filled, ...(await explainedCount(id)) }
})
