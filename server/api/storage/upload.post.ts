import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'

type Purpose = 'test-audio' | 'test-asset' | 'recording' | 'avatar'
const STAFF_PURPOSES: Purpose[] = ['test-audio', 'test-asset']

const PREFIX: Record<Purpose, string> = {
  'test-audio': 'tests/audio',
  'test-asset': 'tests/assets',
  'recording': 'recordings',
  'avatar': 'avatars'
}

function extFromType(type: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
    'audio/wav': 'wav', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov'
  }
  return map[type] || 'bin'
}

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
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
  const maxBytes = contentType.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_BYTES
  if (filePart.data.byteLength > maxBytes) {
    throw createError({ statusCode: 413, message: 'File too large' })
  }

  const scope = purpose === 'avatar' || purpose === 'recording' ? user.id : 'shared'
  const key = `${PREFIX[purpose]}/${scope}/${randomUUID()}.${extFromType(contentType)}`

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
