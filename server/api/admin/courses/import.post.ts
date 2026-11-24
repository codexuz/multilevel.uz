import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema'

// For admins: imports the IELTS Max 24-day course as a private draft: { teacherEmail? } names the
// teacher who will own it (else the admin). The data is read from github.com/codexuz/ielts-course.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const email = String((await readBody<{ teacherEmail?: string }>(event))?.teacherEmail ?? '').trim().toLowerCase()
  let ownerId = admin.id
  if (email) {
    const [u] = await useDb().select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1)
    if (!u) throw createError({ statusCode: 404, message: 'No account with that email' })
    if (areaOf(u.role) === 'student') throw createError({ statusCode: 400, message: 'That account is a student\'s: make it a teacher first' })
    ownerId = u.id
  }
  return await importIeltsMax(ownerId)
})
