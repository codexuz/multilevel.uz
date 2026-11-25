import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'

type Purpose = 'test-audio' | 'test-asset' | 'recording' | 'avatar' | 'course-file' | 'course-audio' | 'course-media' | 'course-image'
const STAFF_PURPOSES: Purpose[] = ['test-audio', 'test-asset']
const TEACHER_PURPOSES: Purpose[] = ['course-file', 'course-audio', 'course-media', 'course-image']

const PREFIX: Record<Purpose, string> = {
  'test-audio': 'tests/audio',
  'test-asset': 'tests/assets',
  'recording': 'recordings',
  'avatar': 'avatars',
  'course-file': 'courses/files',
  'course-audio': 'courses/audio',
  'course-media': 'courses/media',
  'course-image': 'courses/images'
}

// What each purpose may hold. Test files are pictures (maps, diagrams, charts) and
// transcripts (WebVTT, text or PDF); an SVG opened at its own URL is a document and can carry script.
const ALLOWED: Record<Purpose, (mime: string) => boolean> = {
  'test-audio': mime => mime.startsWith('audio/'),
  'test-asset': mime => (mime.startsWith('image/') && mime !== 'image/svg+xml') || ['text/vtt', 'text/plain', 'application/pdf'].includes(mime),
  'recording': mime => mime.startsWith('audio/'),
  'avatar': mime => mime.startsWith('image/') && mime !== 'image/svg+xml',
  // A course lesson's handouts: PDFs.
  'course-file': mime => mime === 'application/pdf',
  // Dictation / listening audio in LMS exercises.
  'course-audio': mime => mime.startsWith('audio/'),
  // A dictation's recording: a sound or a video file.
  'course-media': mime => mime.startsWith('audio/') || ['video/mp4', 'video/webm', 'video/quicktime'].includes(mime),
  // Course covers and LMS question illustrations.
  'course-image': mime => mime.startsWith('image/') && mime !== 'image/svg+xml'
}

const EXT_BY_TYPE: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/aac': 'aac', 'audio/flac': 'flac',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/avif': 'avif', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'text/vtt': 'vtt', 'application/pdf': 'pdf'
}

/**
 * MediaRecorder reports types like `audio/webm;codecs=opus`, so the parameters
 * have to come off before the table lookup — otherwise every recording is `.bin`.
 */
function baseType(type: string): string {
  return type.split(';')[0]!.trim().toLowerCase()
}

function extFromType(type: string, fileName?: string): string {
  const known = EXT_BY_TYPE[baseType(type)]
  if (known) return known

  // Fall back to the uploaded name before giving up on `.bin`.
  const fromName = fileName?.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase()
  return fromName ?? 'bin'
}

const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file' && p.data)
  const purpose = parts?.find(p => p.name === 'purpose')?.data?.toString() as Purpose | undefined

  if (!filePart) throw createError({ statusCode: 400, message: 'file is required' })
  if (!purpose || !PREFIX[purpose]) throw createError({ statusCode: 400, message: 'Invalid purpose' })

  if (STAFF_PURPOSES.includes(purpose) && user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  // Course assets: teachers and admins only (checked against the account, as the token's role may lag).
  if (TEACHER_PURPOSES.includes(purpose)) await requireTeacher(event)

  const contentType = filePart.type || 'application/octet-stream'
  if (!ALLOWED[purpose](baseType(contentType))) {
    throw createError({ statusCode: 415, message: 'This kind of file is not allowed here' })
  }
  if (filePart.data.byteLength > MAX_BYTES) {
    throw createError({ statusCode: 413, message: 'File too large' })
  }

  const scope = purpose === 'avatar' || purpose === 'recording' || TEACHER_PURPOSES.includes(purpose) ? user.id : 'shared'
  const key = `${PREFIX[purpose]}/${scope}/${randomUUID()}.${extFromType(contentType, filePart.filename)}`

  const client = useS3Client()
  await client.send(new PutObjectCommand({
    Bucket: s3Bucket(),
    Key: key,
    Body: filePart.data,
    ContentType: contentType,
    ACL: 'public-read'
  }))

  return { key, publicUrl: s3PublicUrl(key) }
})
