import { and, desc, eq } from 'drizzle-orm'
import { supportFeedback, users } from '../../../database/schema'

const STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed'])
const KINDS = new Set(['bug', 'feedback', 'feature', 'question'])

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const statusFilter = STATUSES.has(String(query.status ?? '')) ? String(query.status) : null
  const kindFilter = KINDS.has(String(query.kind ?? '')) ? String(query.kind) : null

  const db = useDb()

  const allStatuses = await db
    .select({ status: supportFeedback.status })
    .from(supportFeedback)

  const counts = {
    total: allStatuses.length,
    open: allStatuses.filter(r => r.status === 'open').length,
    inProgress: allStatuses.filter(r => r.status === 'in_progress').length,
    resolved: allStatuses.filter(r => r.status === 'resolved' || r.status === 'closed').length
  }

  const conditions = []
  if (statusFilter) conditions.push(eq(supportFeedback.status, statusFilter))
  if (kindFilter) conditions.push(eq(supportFeedback.kind, kindFilter))

  const rows = await db
    .select({
      id: supportFeedback.id,
      kind: supportFeedback.kind,
      subject: supportFeedback.subject,
      message: supportFeedback.message,
      pageUrl: supportFeedback.pageUrl,
      contact: supportFeedback.contact,
      status: supportFeedback.status,
      adminNote: supportFeedback.adminNote,
      resolvedAt: supportFeedback.resolvedAt,
      createdAt: supportFeedback.createdAt,
      userName: users.name,
      userEmail: users.email,
      userTelegram: users.telegramUsername,
      userRole: users.role
    })
    .from(supportFeedback)
    .leftJoin(users, eq(supportFeedback.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supportFeedback.createdAt))
    .limit(100)

  return {
    counts,
    items: rows.map(r => ({
      id: r.id,
      kind: r.kind,
      subject: r.subject,
      message: r.message,
      pageUrl: r.pageUrl,
      contact: r.contact,
      status: r.status,
      adminNote: r.adminNote,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      userName: r.userName,
      userEmail: r.userEmail,
      userTelegram: r.userTelegram,
      userRole: r.userRole
    }))
  } as {
    counts: { total: number, open: number, inProgress: number, resolved: number }
    items: {
      id: string
      kind: string
      subject: string
      message: string
      pageUrl: string | null
      contact: string | null
      status: string
      adminNote: string | null
      resolvedAt: string | null
      createdAt: string
      userName: string | null
      userEmail: string | null
      userTelegram: string | null
      userRole: string | null
    }[]
  }
})
