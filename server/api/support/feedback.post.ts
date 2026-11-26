import { supportFeedback } from '../../database/schema'

const KINDS = new Set(['bug', 'feedback', 'feature', 'question'])
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 10
const buckets = new Map<string, number[]>()

function checkRateLimit(key: string) {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const hits = (buckets.get(key) ?? []).filter(ts => ts > cutoff)
  if (hits.length >= MAX_PER_HOUR) {
    throw createError({ statusCode: 429, message: 'Too many submissions. Please try again later or message @javlon_developer on Telegram.' })
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || v[v.length - 1]! <= cutoff) buckets.delete(k)
    }
  }
}

export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  checkRateLimit(user ? `u:${user.id}` : `ip:${ip}`)

  const body = await readBody<{
    kind?: string
    subject?: string
    message?: string
    pageUrl?: string
    contact?: string
  }>(event)

  const kind = KINDS.has(String(body?.kind ?? '')) ? String(body!.kind) : 'feedback'
  const subject = String(body?.subject ?? '').replace(/\s+/g, ' ').trim()
  const message = String(body?.message ?? '').trim()
  const pageUrl = String(body?.pageUrl ?? '').trim().slice(0, 300) || null
  const contact = String(body?.contact ?? '').trim().slice(0, 120) || null

  if (subject.length < 3 || subject.length > 160) {
    throw createError({ statusCode: 400, message: 'Subject must be between 3 and 160 characters.' })
  }
  if (message.length < 10 || message.length > 3000) {
    throw createError({ statusCode: 400, message: 'Message must be between 10 and 3000 characters.' })
  }

  const db = useDb()
  const [created] = await db.insert(supportFeedback).values({
    userId: user?.id ?? null,
    kind,
    subject,
    message,
    pageUrl,
    contact
  }).returning({
    id: supportFeedback.id,
    kind: supportFeedback.kind,
    subject: supportFeedback.subject,
    message: supportFeedback.message,
    pageUrl: supportFeedback.pageUrl,
    contact: supportFeedback.contact,
    status: supportFeedback.status,
    adminNote: supportFeedback.adminNote,
    createdAt: supportFeedback.createdAt
  })

  return {
    item: created
      ? {
          id: created.id,
          kind: created.kind,
          subject: created.subject,
          message: created.message,
          pageUrl: created.pageUrl,
          contact: created.contact,
          status: created.status,
          adminNote: created.adminNote,
          createdAt: created.createdAt.toISOString()
        }
      : null
  } as {
    item: {
      id: string
      kind: string
      subject: string
      message: string
      pageUrl: string | null
      contact: string | null
      status: string
      adminNote: string | null
      createdAt: string
    } | null
  }
})
