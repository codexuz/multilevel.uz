import { eq } from 'drizzle-orm'
import { courses, exerciseQuestions } from '../../database/schema'

// Deletes an LMS exercise question.
export default defineEventHandler(async (event) => {
  const { course, question } = await requireQuestionTeacher(event, String(getRouterParam(event, 'id')))
  await useDb().delete(exerciseQuestions).where(eq(exerciseQuestions.id, question.id))
  await useDb().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return { ok: true }
})
