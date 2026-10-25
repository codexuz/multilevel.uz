// Transcribes a Listening part's recording with AssemblyAI, stores the WebVTT in S3 and saves its
// address on the part (ai-transcribe.ts).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  if (!transcribeEnabled()) throw createError({ statusCode: 404, message: 'AssemblyAI is not set up' })
  const id = getRouterParam(event, 'id')!
  const body = (await readBody<{ overwrite?: boolean }>(event)) ?? {}
  return transcribePart(id, { overwrite: !!body.overwrite })
})
