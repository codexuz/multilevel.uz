import type { AuthUser } from './auth'
import type { Attachment } from '~/types/community'
import { htmlToText } from '~/utils/html-text'
import { MAX_ATTACHMENTS, MAX_BODY_LENGTH, MAX_TITLE_LENGTH, isAttachment } from '~/types/community'

/** Authors moderate their own content; staff moderate everyone's. */
export function canModerate(user: AuthUser, authorId: string): boolean {
  return user.id === authorId || user.role === 'admin' || user.role === 'examiner'
}

interface AuthorRow {
  id: string
  name: string | null
  avatarUrl: string | null
  role: string
}

export function toAuthor(row: AuthorRow) {
  return { id: row.id, name: row.name, avatarUrl: row.avatarUrl, role: row.role }
}

/**
 * Bodies arrive as TipTap HTML. Cap the raw markup, sanitize it, then require
 * that something visible survives — an empty editor still posts `<p></p>`.
 */
export function readBodyText(raw: unknown, field = 'body'): string {
  const html = typeof raw === 'string' ? raw.trim() : ''
  if (html.length > MAX_BODY_LENGTH) {
    throw createError({ statusCode: 400, message: `${field} is too long` })
  }

  const clean = sanitizeRichText(html)
  if (!htmlToText(clean)) throw createError({ statusCode: 400, message: `${field} is required` })
  return clean
}

export function readTitle(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const title = typeof raw === 'string' ? raw.trim() : ''
  if (!title) return null
  if (title.length > MAX_TITLE_LENGTH) throw createError({ statusCode: 400, message: 'title is too long' })
  return title
}

/**
 * Only accept attachments pointing at our own storage — otherwise a client could
 * store arbitrary third-party URLs that we then render into every reader's page.
 */
export function readAttachments(raw: unknown): Attachment[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) throw createError({ statusCode: 400, message: 'attachments must be an array' })
  if (raw.length > MAX_ATTACHMENTS) {
    throw createError({ statusCode: 400, message: `At most ${MAX_ATTACHMENTS} attachments` })
  }

  const base = s3PublicUrl('')
  return raw.map((item) => {
    if (!isAttachment(item)) throw createError({ statusCode: 400, message: 'Invalid attachment' })
    if (!item.url.startsWith(base)) {
      throw createError({ statusCode: 400, message: 'Attachment must be an uploaded file' })
    }
    return { type: item.type, url: item.url }
  })
}
