import { eq } from 'drizzle-orm'
import { courses, exerciseQuestions } from '../../database/schema'

// Updates an LMS exercise question.
export default defineEventHandler(async (event) => {
  const { course, question } = await requireQuestionTeacher(event, String(getRouterParam(event, 'id')))
  const set = questionValues((await readBody(event)) ?? {}, true)
  const [row] = await useDb().update(exerciseQuestions).set({ ...set, updatedAt: new Date() }).where(eq(exerciseQuestions.id, question.id)).returning()
  await useDb().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return row
})
