import { and, eq } from 'drizzle-orm'
import { lessonProgress } from '../../../database/schema'

// Not done after all.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const lesson = await findLesson(String(getRouterParam(event, 'id')))
  await useDb().delete(lessonProgress).where(and(eq(lessonProgress.lessonId, lesson.id), eq(lessonProgress.userId, user.id)))
  return { done: false }
})
