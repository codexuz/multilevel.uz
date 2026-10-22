import { createHash } from 'node:crypto'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { asc, eq } from 'drizzle-orm'
import { speakingParts, speakingQuestions } from '../database/schema'

/**
 * The examiner's voice: each question (or Part 2's card, Part 3's statement) read aloud once by
 * OpenAI's text-to-speech and kept in storage, so every candidate hears the same clip. Without
 * OpenAI or storage the exam falls back to the browser's own voice.
 */

const TTS_MODEL = () => process.env.AI_TTS_MODEL || 'gpt-4o-mini-tts'
const TTS_VOICE = () => process.env.AI_TTS_VOICE || 'sage'
const INSTRUCTIONS = 'You are a calm, friendly English speaking examiner. Speak clearly at a natural, unhurried pace with neutral British pronunciation.'

export const examinerVoiceEnabled = () => aiEnabled() && !!(process.env.S3_BUCKET || useRuntimeConfig().s3Bucket)

const plain = (html: string | null) => (html ?? '')
  .replace(/<table[\s\S]*?<\/table>/gi, ' ')
  .replace(/<\/(p|li|h\d)>/gi, '. ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').replace(/(\.\s*)+/g, '. ').replace(/\s+([.,?!])/g, '$1').replace(/([?!])\./g, '$1')
  .trim()

/** What the examiner says for a turn, the way the bot says it. */
export async function spokenText(partId: string, position: number): Promise<string | null> {
  const db = useDb()
  const [part] = await db.select().from(speakingParts).where(eq(speakingParts.id, partId)).limit(1)
  if (!part) return null
  const questions = await db.select({ text: speakingQuestions.text }).from(speakingQuestions)
    .where(eq(speakingQuestions.partId, partId)).orderBy(asc(speakingQuestions.position))
  if (answeredByQuestion(part.partNumber, part.exam) && questions.length) return plain(questions[position]?.text ?? null) || null
  if (part.partNumber === 4) return `Part 3. ${plain(part.cueCard)} Use the arguments for and against.`.trim()
  return `Part 2. ${plain(part.cueCard) || questions.map(q => plain(q.text)).join(' ')}`.trim()
}

/** The clip's public address, made the first time it is asked for. */
export async function examinerClip(text: string): Promise<string> {
  const key = `tts/${createHash('sha256').update(`${TTS_MODEL()}|${TTS_VOICE()}|${text}`).digest('hex').slice(0, 40)}.mp3`
  const s3 = useS3Client()
  const exists = await s3.send(new HeadObjectCommand({ Bucket: s3Bucket(), Key: key })).then(() => true, () => false)
  if (!exists) {
    const speech = await openaiClient().audio.speech.create({ model: TTS_MODEL(), voice: TTS_VOICE(), input: text.slice(0, 4000), instructions: INSTRUCTIONS, response_format: 'mp3' })
    const body = Buffer.from(await speech.arrayBuffer())
    await s3.send(new PutObjectCommand({ Bucket: s3Bucket(), Key: key, Body: body, ContentType: 'audio/mpeg', ACL: 'public-read', CacheControl: 'public, max-age=31536000, immutable' }))
  }
  return s3PublicUrl(key)
}
