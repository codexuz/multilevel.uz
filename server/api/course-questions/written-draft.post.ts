// Key points and a model answer for a written response, drafted by the AI for the teacher to edit.
export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const b = (await readBody<{ mode?: string, prompt?: string, context?: string | null, imageRef?: string | null, minWords?: number | null, maxWords?: number | null }>(event)) ?? {}
  const mode = WRITTEN_MODES.includes(b.mode as never) ? String(b.mode) : 'SUMMARY'
  if (mode === 'SUMMARY' && !String(b.context ?? '').trim()) throw createError({ statusCode: 400, message: 'Paste the article first' })
  if (mode === 'DESCRIBE_IMAGE' && !b.imageRef) throw createError({ statusCode: 400, message: 'Add the picture first' })
  return await draftWrittenKeys(user.id, { mode, prompt: String(b.prompt ?? ''), context: b.context ?? null, imageRef: b.imageRef ?? null, minWords: b.minWords ?? null, maxWords: b.maxWords ?? null })
})
