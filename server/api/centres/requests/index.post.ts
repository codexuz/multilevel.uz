import { and, eq } from 'drizzle-orm'
import { centreRequests } from '../../../database/schema'

// A learning centre asks to join. One open request per account; the admins hear of it on Telegram.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = (await readBody<Record<string, unknown>>(event)) ?? {}
  const name = String(body.name ?? '').trim().slice(0, 120)
  const phone = String(body.phone ?? '').trim().slice(0, 40)
  if (!name) throw createError({ statusCode: 400, message: 'Give the centre\'s name' })
  if (!/\d{7,}/.test(phone.replace(/\D/g, ''))) throw createError({ statusCode: 400, message: 'Give a phone number we can call' })
  const students = Math.round(Number(body.students))
  const db = useDb()
  const [open] = await db.select({ id: centreRequests.id }).from(centreRequests)
    .where(and(eq(centreRequests.userId, user.id), eq(centreRequests.status, 'PENDING'))).limit(1)
  if (open) throw createError({ statusCode: 409, message: 'Your request is already with us. We will be in touch soon.' })
  const [row] = await db.insert(centreRequests).values({
    userId: user.id, name, phone,
    city: String(body.city ?? '').trim().slice(0, 80) || null,
    telegram: telegramHandle(body.telegram),
    students: Number.isFinite(students) && students > 0 ? Math.min(students, 100_000) : null,
    message: String(body.message ?? '').trim().slice(0, 1000) || null
  }).returning()
  await notifyAdminsOfRequest(row!.name, row!.city, row!.students).catch(() => {})
  return { id: row!.id, status: row!.status, createdAt: row!.createdAt }
})
