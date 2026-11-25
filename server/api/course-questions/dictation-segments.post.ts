// A dictation recording (an uploaded audio or video file) split into timed sentences: { ref } → { segments: [{ start, end, text }] }.
export default defineEventHandler(async (event) => {
  await requireTeacher(event)
  const ref = String((await readBody<{ ref?: string }>(event))?.ref ?? '').trim()
  if (!ref) throw createError({ statusCode: 400, message: 'Upload the recording first' })
  return { segments: await transcribeToSegments(ref) }
})
