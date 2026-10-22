import { eq } from 'drizzle-orm'
import { users } from '../database/schema'

/** The exam a user prepares for: the one they chose, else IELTS (the exam most people come for). */
export async function preferredExam(userId: string): Promise<Exam> {
  const [u] = await useDb().select({ exam: users.exam }).from(users).where(eq(users.id, userId)).limit(1)
  return isExam(u?.exam) ? u.exam : 'IELTS'
}
