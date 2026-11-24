import { eq } from 'drizzle-orm'
import { courseModules, courses } from '../../database/schema'

// Deletes a course unit/module (its lessons stay in the course as ungrouped unless removed individually).
export default defineEventHandler(async (event) => {
  const { course, module: mod } = await requireModuleTeacher(event, String(getRouterParam(event, 'id')))
  await useDb().delete(courseModules).where(eq(courseModules.id, mod.id))
  await useDb().update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, course.id))
  return { ok: true }
})
