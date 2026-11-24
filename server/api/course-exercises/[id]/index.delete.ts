import { eq } from 'drizzle-orm'
import { courses, lessonExercises } from '../../../database/schema'

// Deletes an exercise and its questions/attempts.
export default defineEventHandler(async (event) => {
  const { course, exercise } = await requireExerciseTeacher(event, String(getRouterParam(event, 'id')))
  await useDb().delete(lessonExercises).where(eq(lessonExercises.id, exercise.id))
  await useDb().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return { ok: true }
})
