import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
  }
  return map[type] || 'bin'
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const body = await readBody<{ purpose: Purpose, contentType: string, fileName?: string }>(event)
  const purpose = body?.purpose
  const contentType = body?.contentType

  if (!purpose || !PREFIX[purpose]) {
    throw createError({ statusCode: 400, message: 'Invalid purpose' })
  }
  if (!contentType) {
    throw createError({ statusCode: 400, message: 'contentType is required' })
  }

  // Staff-only purposes require examiner/admin role.
  if (STAFF_PURPOSES.includes(purpose)) {
    const role = await getRole(event, user.id)
    if (role !== 'admin' && role !== 'examiner') {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
  }

  const scope = purpose === 'avatar' || purpose === 'recording' ? user.id : 'shared'
  const key = `${PREFIX[purpose]}/${scope}/${randomUUID()}.${extFromType(contentType)}`

  const client = useS3Client()
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: s3Bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 60 * 5 }
  )

  return { uploadUrl: url, key, publicUrl: s3PublicUrl(key) }
})
