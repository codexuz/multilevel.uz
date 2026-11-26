import { createHash } from 'node:crypto'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { SpeechifyClient } from '@speechify/api'
import type { Speechify } from '@speechify/api'

/**
 * Vocabulary pronunciation via Speechify TTS (`simba-3.5`, `geffen_32` by default), cached
 * permanently in S3 under `tts/vocab/<hash>.mp3` so every word or phrase is only synthesized once.
 * Falls back to an in-memory LRU cache when S3 is not configured (e.g. local dev).
 */
const MAX_TEXT_CHARS = 240
const MEM_CACHE_MAX = 200

const inFlight = new Map<string, Promise<VocabAudioResult>>()
const memCache = new Map<string, Buffer>()

export type VocabAudioResult = { url: string, buffer?: never } | { buffer: Buffer, url?: never }

function speechifyConfig() {
  const cfg = useRuntimeConfig()
  const token = String(process.env.SPEECHIFY_API_KEY || cfg.speechifyApiKey || '').trim()
  const model = String(process.env.SPEECHIFY_MODEL || cfg.speechifyModel || 'simba-3.5').trim() as Speechify.GetSpeechRequest.Model
  const voiceId = String(process.env.SPEECHIFY_VOICE_ID || cfg.speechifyVoiceId || 'geffen_32').trim()
  return { token, model, voiceId }
}

export function vocabVoiceEnabled(): boolean {
  return !!speechifyConfig().token
}

function s3Configured(): boolean {
  const cfg = useRuntimeConfig()
  return !!(
    (process.env.S3_BUCKET || cfg.s3Bucket)
    && (process.env.S3_ACCESS_KEY_ID || cfg.s3AccessKeyId)
    && (process.env.S3_SECRET_ACCESS_KEY || cfg.s3SecretAccessKey)
    && (process.env.S3_PUBLIC_URL || cfg.public?.s3PublicUrl)
  )
}

function rememberInMemory(key: string, buf: Buffer) {
  if (memCache.size >= MEM_CACHE_MAX) {
    const oldest = memCache.keys().next().value
    if (oldest) memCache.delete(oldest)
  }
  memCache.set(key, buf)
}

export function normalizeVocabText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS)
}

/** Synthesizes (or loads from S3 cache) an MP3 clip for a vocabulary word or short phrase. */
export async function vocabVoiceAudio(rawText: string): Promise<VocabAudioResult> {
  const text = normalizeVocabText(rawText)
  if (!text) throw createError({ statusCode: 400, message: 'text is required' })

  const { token, model, voiceId } = speechifyConfig()
  if (!token) throw createError({ statusCode: 404, message: 'Speechify TTS is not configured' })

  // Case-insensitive cache key so "Sustainable" and "sustainable" reuse the same MP3.
  const hash = createHash('sha256').update(`speechify|${model}|${voiceId}|${text.toLowerCase()}`).digest('hex').slice(0, 40)
  const key = `tts/vocab/${hash}.mp3`

  const existing = inFlight.get(key)
  if (existing) return existing

  const task = (async (): Promise<VocabAudioResult> => {
    const useS3 = s3Configured()

    if (useS3) {
      const s3 = useS3Client()
      const hit = await s3.send(new HeadObjectCommand({ Bucket: s3Bucket(), Key: key })).then(() => true, () => false)
      if (hit) return { url: s3PublicUrl(key) }
    } else {
      const cached = memCache.get(key)
      if (cached) return { buffer: cached }
    }

    const client = new SpeechifyClient({ token })
    const res = await client.audio.speech({
      audio_format: 'mp3',
      input: text,
      model,
      voice_id: voiceId
    })

    if (!res?.audio_data) {
      throw createError({ statusCode: 502, message: 'Speechify returned empty audio' })
    }
    const buf = Buffer.from(res.audio_data, 'base64')

    if (useS3) {
      const s3 = useS3Client()
      await s3.send(new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: key,
        Body: buf,
        ContentType: 'audio/mpeg',
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable'
      }))
      return { url: s3PublicUrl(key) }
    }

    rememberInMemory(key, buf)
    return { buffer: buf }
  })()

  inFlight.set(key, task)
  try {
    return await task
  } finally {
    inFlight.delete(key)
  }
}
