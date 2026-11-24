import { eq } from 'drizzle-orm'
import { courses, lessonExercises } from '../../../database/schema'

// Updates an exercise's settings.
export default defineEventHandler(async (event) => {
  const { course, exercise } = await requireExerciseTeacher(event, String(getRouterParam(event, 'id')))
  const set = exerciseValues((await readBody(event)) ?? {}, true)
  const [row] = await useDb().update(lessonExercises).set({ ...set, updatedAt: new Date() }).where(eq(lessonExercises.id, exercise.id)).returning()
  await useDb().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return row
})
