/**
 * Pronounces an English vocabulary word or short phrase using Speechify TTS (`simba-3.5`),
 * cached permanently in S3. Returns 302 to the CDN MP3 URL (or streams MP3 bytes in dev),
 * or 404 when SPEECHIFY_API_KEY is not configured so the client falls back to browser TTS.
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 120
const buckets = new Map<string, number[]>()

function checkRateLimit(key: string) {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const hits = (buckets.get(key) ?? []).filter(ts => ts > cutoff)
  if (hits.length >= MAX_PER_WINDOW) {
    throw createError({ statusCode: 429, message: 'Too many pronunciation requests' })
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || v[v.length - 1]! <= cutoff) buckets.delete(k)
    }
  }
}

export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  checkRateLimit(user ? `u:${user.id}` : `ip:${ip}`)

  if (!vocabVoiceEnabled()) {
    throw createError({ statusCode: 404, message: 'Vocabulary voice is not configured' })
  }

  const query = getQuery(event)
  const text = normalizeVocabText(String(query.text ?? ''))
  if (!text) {
    throw createError({ statusCode: 400, message: 'text is required' })
  }

  try {
    const result = await vocabVoiceAudio(text)
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    if (result.url) {
      return sendRedirect(event, result.url, 302)
    }
    setHeader(event, 'Content-Type', 'audio/mpeg')
    return result.buffer
  } catch (e: any) {
    if (e?.statusCode && e.statusCode < 500) throw e
    console.error('[vocab-voice] Speechify TTS failed:', e?.message ?? e)
    throw createError({ statusCode: 503, message: 'Vocabulary voice temporarily unavailable' })
  }
})
