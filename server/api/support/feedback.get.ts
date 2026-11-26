import { desc, eq } from 'drizzle-orm'
import { supportFeedback } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  const items = await db
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
      createdAt: supportFeedback.createdAt
    })
    .from(supportFeedback)
    .where(eq(supportFeedback.userId, user.id))
    .orderBy(desc(supportFeedback.createdAt))
    .limit(50)

  return {
    items: items.map(i => ({
      id: i.id,
      kind: i.kind,
      subject: i.subject,
      message: i.message,
      pageUrl: i.pageUrl,
      contact: i.contact,
      status: i.status,
      adminNote: i.adminNote,
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString()
    }))
  } as {
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
    }[]
  }
})
