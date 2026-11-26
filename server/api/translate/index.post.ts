/**
 * Server-side proxy for the Tilmoch / Tahrirchi translate-v2 API so TILMOCH_API_KEY stays secret.
 * Accepts `{ texts: string[] }` (or `{ text: string }`), `source_lang`, `target_lang`, and
 * returns `{ translations: string[], source_lang, target_lang, model }`.
 */
const ALLOWED_LANGS = new Set(['uzn_Latn', 'eng_Latn', 'rus_Cyrl'])

// Lightweight sliding-window rate limiter per user/IP (60 requests / minute).
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60
const buckets = new Map<string, number[]>()

function checkRateLimit(key: string) {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const hits = (buckets.get(key) ?? []).filter(ts => ts > cutoff)
  if (hits.length >= MAX_PER_WINDOW) {
    throw createError({ statusCode: 429, message: 'Too many translation requests. Please wait a moment.' })
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || v[v.length - 1]! <= cutoff) buckets.delete(k)
    }
  }
}

function extractTranslations(payload: unknown): string[] | null {
  if (Array.isArray(payload) && payload.every(x => typeof x === 'string')) return payload
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    for (const key of ['translated_texts', 'translations', 'texts', 'result', 'results', 'data']) {
      const val = obj[key]
      if (Array.isArray(val)) {
        const strs = val.map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const rec = item as Record<string, unknown>
            const s = rec.translated_text ?? rec.translation ?? rec.text ?? rec.target
            if (typeof s === 'string') return s
          }
          return null
        })
        if (strs.every((s): s is string => typeof s === 'string')) return strs
      }
      if (typeof val === 'string') return [val]
    }
    if (typeof obj.translated_text === 'string') return [obj.translated_text]
    if (typeof obj.translation === 'string') return [obj.translation]
  }
  return null
}

export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  checkRateLimit(user ? `u:${user.id}` : `ip:${ip}`)

  const config = useRuntimeConfig()
  const apiKey = String(config.tilmochApiKey || '').trim()
  if (!apiKey) {
    throw createError({ statusCode: 503, message: 'Tilmoch translation API is not configured yet (set TILMOCH_API_KEY).' })
  }

  const body = await readBody<{
    text?: unknown
    texts?: unknown
    source_lang?: unknown
    target_lang?: unknown
    model?: unknown
  }>(event)

  const rawTexts = Array.isArray(body?.texts)
    ? body.texts
    : body?.text !== undefined
      ? [body.text]
      : []

  const texts = rawTexts
    .map(v => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, 10)
    .map(s => s.slice(0, 500))

  if (!texts.length) {
    throw createError({ statusCode: 400, message: 'Enter a word or phrase to translate.' })
  }

  const sourceLang = String(body?.source_lang ?? 'eng_Latn')
  const targetLang = String(body?.target_lang ?? 'uzn_Latn')
  if (!ALLOWED_LANGS.has(sourceLang) || !ALLOWED_LANGS.has(targetLang)) {
    throw createError({ statusCode: 400, message: 'Unsupported language pair.' })
  }
  if (sourceLang === targetLang) {
    return { translations: texts, source_lang: sourceLang, target_lang: targetLang, model: String(config.tilmochModel || 'sayqalchi') }
  }

  const apiUrl = String(config.tilmochApiUrl || 'https://websocket.tahrirchi.uz/translate-v2')
  const model = String(config.tilmochModel || 'sayqalchi')

  let res: Response
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify({
        texts,
        source_lang: sourceLang,
        target_lang: targetLang,
        model
      })
    })
  } catch (e: any) {
    console.error('[tilmoch] network error:', e?.message || e)
    throw createError({ statusCode: 502, message: 'Could not reach Tilmoch translation service. Please try again.' })
  }

  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = (payload && typeof payload === 'object' && ('detail' in payload || 'message' in payload || 'error' in payload))
      ? String((payload as Record<string, unknown>).detail ?? (payload as Record<string, unknown>).message ?? (payload as Record<string, unknown>).error)
      : `HTTP ${res.status}`
    console.warn('[tilmoch] upstream error:', res.status, detail)
    throw createError({ statusCode: 502, message: `Translation failed: ${detail}` })
  }

  const translations = extractTranslations(payload)
  if (!translations) {
    console.error('[tilmoch] unexpected response:', payload)
    throw createError({ statusCode: 502, message: 'Unexpected response from Tilmoch translation service.' })
  }

  return {
    translations,
    source_lang: sourceLang,
    target_lang: targetLang,
    model
  }
})
