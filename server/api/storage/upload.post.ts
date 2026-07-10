import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'

type Purpose = 'test-audio' | 'test-asset' | 'recording' | 'avatar' | 'community'
const STAFF_PURPOSES: Purpose[] = ['test-audio', 'test-asset']

const PREFIX: Record<Purpose, string> = {
  'test-audio': 'tests/audio',
  'test-asset': 'tests/assets',
  'recording': 'recordings',
  'avatar': 'avatars',
  'community': 'community'
}

// Community posts are user-generated, so only images and audio are accepted —
// video would otherwise slip in under the 200 MB ceiling below.
const MEDIA_ONLY_PURPOSES: Purpose[] = ['community']

const EXT_BY_TYPE: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/aac': 'aac', 'audio/flac': 'flac',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/avif': 'avif', 'image/heic': 'heic', 'image/svg+xml': 'svg',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov'
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
const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200 MB

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file' && p.data)
  const purpose = parts?.find(p => p.name === 'purpose')?.data?.toString() as Purpose | undefined

  if (!filePart) throw createError({ statusCode: 400, message: 'file is required' })
  if (!purpose || !PREFIX[purpose]) throw createError({ statusCode: 400, message: 'Invalid purpose' })

  if (STAFF_PURPOSES.includes(purpose) && user.role !== 'admin' && user.role !== 'examiner') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const contentType = filePart.type || 'application/octet-stream'
  const mime = baseType(contentType)

  if (MEDIA_ONLY_PURPOSES.includes(purpose)) {
    if (!mime.startsWith('image/') && !mime.startsWith('audio/')) {
      throw createError({ statusCode: 415, message: 'Only images and audio are allowed' })
    }
    // An SVG opened at its own URL is a document, and can carry script.
    if (mime === 'image/svg+xml') {
      throw createError({ statusCode: 415, message: 'SVG images are not allowed' })
    }
  }

  const maxBytes = mime.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_BYTES
  if (filePart.data.byteLength > maxBytes) {
    throw createError({ statusCode: 413, message: 'File too large' })
  }

  const scope = purpose === 'avatar' || purpose === 'recording' || purpose === 'community'
    ? user.id
    : 'shared'
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
