// The examiner reading one turn of a Speaking part aloud (?part=<id>&position=<n>): a redirect to
// the test's own audio for it, or to the generated clip. 404 when there is neither; the exam then
// uses the browser's voice.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const partId = String(query.part ?? '')
  const position = Math.max(0, Math.floor(Number(query.position) || 0))
  if (!/^[0-9a-f-]{36}$/i.test(partId)) throw createError({ statusCode: 400, message: 'Which part?' })
  const turn = await examinerTurn(partId, position)
  if (!turn?.audioUrl && !turn?.text) throw createError({ statusCode: 404, message: 'Nothing to read' })
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  if (turn.audioUrl) return sendRedirect(event, turn.audioUrl, 302)
  if (!examinerVoiceEnabled()) throw createError({ statusCode: 404, message: 'The examiner voice is not set up' })
  const url = await examinerClip(turn.text!).catch((e) => {
    console.error('[examiner-voice] failed:', e?.message ?? e)
    throw createError({ statusCode: 503, message: 'The examiner voice is not available' })
  })
  return sendRedirect(event, url, 302)
})
