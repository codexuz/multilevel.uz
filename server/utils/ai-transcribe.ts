import { randomUUID } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { AssemblyAI, type Transcript, type TranscriptWord } from 'assemblyai'
import { eq } from 'drizzle-orm'
import { parts } from '../database/schema'
import { sign } from './content'
import { s3Bucket, s3KeyFromUrl, s3PublicUrl, useS3Client } from './s3'

/**
 * Transcribes a Listening part's recording once with AssemblyAI, turns the timed words and speaker
 * turns into a WebVTT (.vtt) file, stores it in S3 and saves its address on the part
 * (`parts.transcriptRef`). The review panel then follows the audio line by line, and `ai-explain`
 * can quote the transcript when writing answer explanations.
 */

const apiKey = () => process.env.ASSEMBLYAI_API_KEY || (useRuntimeConfig().assemblyaiApiKey as string | undefined) || ''

export const transcribeEnabled = () => !!apiKey()

let client: AssemblyAI | null = null
let clientKey = ''
function assemblyClient(): AssemblyAI {
  const key = apiKey()
  if (!client || clientKey !== key) {
    client = new AssemblyAI({ apiKey: key })
    clientKey = key
  }
  return client
}

function vttTime(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3_600_000)
  const m = Math.floor((total % 3_600_000) / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  const milli = total % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`
}

const ABBREV_RE = /^(mr|mrs|ms|dr|prof|st|jr|sr|vs|etc)\.$|^[a-z]\.[a-z]\.$/i
const SENTENCE_END_RE = /[.?!]["')\]]*$/
const CLAUSE_END_RE = /[,;:—–-]["')\]]*$/

interface VttCue {
  start: number
  end: number
  text: string
}

/** Splits a sequence of timed words into sentence-sized cues for readable follow-along playback. */
function wordsToCues(words: TranscriptWord[]): VttCue[] {
  const cues: VttCue[] = []
  let buf: TranscriptWord[] = []
  const flush = () => {
    if (!buf.length) return
    const text = buf.map(w => w.text.trim()).filter(Boolean).join(' ')
    if (text) cues.push({ start: buf[0]!.start, end: Math.max(buf[0]!.start + 200, buf[buf.length - 1]!.end), text })
    buf = []
  }
  for (const w of words) {
    if (!w.text?.trim()) continue
    buf.push(w)
    const token = w.text.trim()
    const endsSentence = SENTENCE_END_RE.test(token) && !ABBREV_RE.test(token)
    const endsLongClause = buf.length >= 22 && CLAUSE_END_RE.test(token)
    if ((endsSentence && buf.length >= 3) || endsLongClause || buf.length >= 32) {
      flush()
    }
  }
  flush()
  return cues
}

/** Converts an AssemblyAI transcript into WebVTT content and the number of cues written. */
export function transcriptToVtt(transcript: Transcript): { vtt: string, cues: number } {
  const cues: VttCue[] = []
  if (transcript.utterances?.length) {
    for (const u of transcript.utterances) {
      if (u.words?.length) {
        cues.push(...wordsToCues(u.words))
      } else if (u.text?.trim()) {
        cues.push({ start: u.start, end: Math.max(u.start + 200, u.end), text: u.text.trim() })
      }
    }
  } else if (transcript.words?.length) {
    cues.push(...wordsToCues(transcript.words))
  } else if (transcript.text?.trim()) {
    const durationMs = Math.max(1000, Math.round((transcript.audio_duration ?? 60) * 1000))
    cues.push({ start: 0, end: durationMs, text: transcript.text.trim() })
  }

  const blocks = cues.map((cue, idx) => `${idx + 1}\n${vttTime(cue.start)} --> ${vttTime(cue.end)}\n${cue.text}`)
  return {
    vtt: `WEBVTT\n\n${blocks.join('\n\n')}\n`,
    cues: cues.length
  }
}

/** Reads the audio from our S3 bucket when stored there, or passes an external https URL to AssemblyAI. */
async function resolveAudioInput(audioRef: string): Promise<string | Buffer> {
  const key = s3KeyFromUrl(audioRef)
  if (key) {
    try {
      const obj = await useS3Client().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key }))
      if (obj.Body) return Buffer.from(await obj.Body.transformToByteArray())
    } catch (e) {
      if (!/^https:\/\//i.test(audioRef)) throw e
    }
  }
  if (!/^https?:\/\//i.test(audioRef)) {
    throw createError({ statusCode: 400, message: 'The recording address is not valid' })
  }
  return audioRef
}

export interface TranscribePartResult {
  transcriptRef: string
  transcriptUrl: string | null
  created: boolean
  cues: number
  durationSeconds: number | null
}

const running = new Map<string, Promise<TranscribePartResult>>()

/**
 * Transcribes a Listening part's audio with AssemblyAI, uploads the resulting `.vtt` file to S3,
 * and saves its URL in `parts.transcriptRef`. Concurrent requests for the same part share one job.
 */
export function transcribePart(partId: string, opts: { overwrite?: boolean } = {}): Promise<TranscribePartResult> {
  const cacheKey = `${partId}:${!!opts.overwrite}`
  const ongoing = running.get(cacheKey)
  if (ongoing) return ongoing

  const job = (async (): Promise<TranscribePartResult> => {
    const db = useDb()
    const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1)
    if (!part) throw createError({ statusCode: 404, message: 'Part not found' })
    if (part.skill !== 'LISTENING') throw createError({ statusCode: 400, message: 'Only Listening parts have a recording to transcribe' })
    if (!part.audioRef?.trim()) throw createError({ statusCode: 409, message: 'This part has no recording to transcribe' })

    if (part.transcriptRef?.trim() && !opts.overwrite) {
      return {
        transcriptRef: part.transcriptRef,
        transcriptUrl: sign(part.transcriptRef),
        created: false,
        cues: 0,
        durationSeconds: null
      }
    }

    const audio = await resolveAudioInput(part.audioRef.trim())
    const transcript = await assemblyClient().transcripts.transcribe({
      audio,
      language_code: 'en',
      speaker_labels: true
    })

    if (transcript.status === 'error' || !transcript.text?.trim()) {
      throw createError({
        statusCode: 502,
        message: transcript.error || 'The recording could not be transcribed. Please try again.'
      })
    }

    const { vtt, cues } = transcriptToVtt(transcript)
    const key = `tests/assets/shared/${randomUUID()}.vtt`
    await useS3Client().send(new PutObjectCommand({
      Bucket: s3Bucket(),
      Key: key,
      Body: Buffer.from(vtt, 'utf-8'),
      ContentType: 'text/vtt; charset=utf-8',
      ACL: 'public-read'
    }))

    const publicUrl = s3PublicUrl(key)
    await db.update(parts).set({
      transcriptRef: publicUrl,
      updatedAt: new Date()
    }).where(eq(parts.id, partId))

    console.info(`[ai-transcribe] part ${partId}: ${cues} cues, ${transcript.audio_duration ?? 0}s -> ${key}`)
    return {
      transcriptRef: publicUrl,
      transcriptUrl: sign(publicUrl),
      created: true,
      cues,
      durationSeconds: transcript.audio_duration ?? null
    }
  })().finally(() => running.delete(cacheKey))

  running.set(cacheKey, job)
  return job
}
