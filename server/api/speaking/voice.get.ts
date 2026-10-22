// The examiner reading one turn of a Speaking part aloud (?part=<id>&position=<n>): a redirect to
// the clip. 404 when the examiner's voice is not set up; the exam then uses the browser's voice.
export default defineEventHandler(async (event) => {
  if (!examinerVoiceEnabled()) throw createError({ statusCode: 404, message: 'The examiner voice is not set up' })
  const query = getQuery(event)
  const partId = String(query.part ?? '')
  const position = Math.max(0, Math.floor(Number(query.position) || 0))
  if (!/^[0-9a-f-]{36}$/i.test(partId)) throw createError({ statusCode: 400, message: 'Which part?' })
  const text = await spokenText(partId, position)
  if (!text) throw createError({ statusCode: 404, message: 'Nothing to read' })
  const url = await examinerClip(text).catch((e) => {
    console.error('[examiner-voice] failed:', e?.message ?? e)
    throw createError({ statusCode: 503, message: 'The examiner voice is not available' })
  })
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return sendRedirect(event, url, 302)
})
