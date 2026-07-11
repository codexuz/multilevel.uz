import { Readable } from 'node:stream'
import { and, eq } from 'drizzle-orm'
import { lessons, courseModules, enrollments } from '../../../../../database/schema'

// URLs that are meant to be embedded client-side (public players) are never
// streamed through here.
const EMBED_RE = /(?:youtube\.com|youtu\.be|vimeo\.com)/i

/**
 * Gated video stream. Only an authenticated, enrolled user (or anyone, for a
 * preview lesson) can reach the bytes, and the real source URL is never handed
 * to the client:
 *   - S3-hosted objects → a short-lived signed URL via 302 redirect.
 *   - External direct files → proxied through the server so the origin stays
 *     hidden and each request is re-authorized. Range is forwarded so seeking
 *     and progressive download keep working.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const courseId = getRouterParam(event, 'id')!
  const lessonId = getRouterParam(event, 'lessonId')!
  const db = useDb()

  const [lesson] = await db.select({
    videoUrl: lessons.videoUrl,
    isPreview: lessons.isPreview
  }).from(lessons)
    .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
    .where(and(eq(lessons.id, lessonId), eq(courseModules.courseId, courseId)))
    .limit(1)

  if (!lesson?.videoUrl || EMBED_RE.test(lesson.videoUrl)) {
    throw createError({ statusCode: 404, message: 'No streamable video for this lesson' })
  }

  if (!lesson.isPreview) {
    const [enrollment] = await db.select({ id: enrollments.id }).from(enrollments)
      .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))).limit(1)
    if (!enrollment) throw createError({ statusCode: 403, message: 'Enroll to watch this video' })
  }

  // Keep the signed/redirected URL out of shared caches.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  // S3-hosted object → offload delivery to the bucket via a short-lived URL.
  const key = s3KeyFromUrl(lesson.videoUrl)
  if (key) {
    return sendRedirect(event, await presignGetObject(key, 300), 302)
  }

  // External direct file → proxy the bytes, forwarding the Range request.
  const range = getRequestHeader(event, 'range')
  const upstream = await fetch(lesson.videoUrl, { headers: range ? { range } : {} })
  if (!upstream.ok && upstream.status !== 206) {
    throw createError({ statusCode: 502, message: 'Upstream video error' })
  }
  setResponseStatus(event, upstream.status)
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = upstream.headers.get(h)
    if (v) setResponseHeader(event, h, v)
  }
  if (!upstream.body) return null
  return sendStream(event, Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]))
})
