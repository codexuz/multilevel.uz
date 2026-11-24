import { eq } from 'drizzle-orm'
import { courseModules, courses } from '../../database/schema'

// Updates a course unit/module (title, description, content drip settings).
export default defineEventHandler(async (event) => {
  const { course, module: mod } = await requireModuleTeacher(event, String(getRouterParam(event, 'id')))
  const set = moduleValues((await readBody(event)) ?? {}, true)
  const [row] = await useDb().update(courseModules).set({ ...set, updatedAt: new Date() }).where(eq(courseModules.id, mod.id)).returning()
  await useDb().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return row
})
