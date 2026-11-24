import { eq } from 'drizzle-orm'
import { courseLessons, liveLessons } from '../../../database/schema'

// Deletes a lesson (its online class, if any, is cancelled).
export default defineEventHandler(async (event) => {
  const { lesson } = await requireLessonTeacher(event, String(getRouterParam(event, 'id')))
  if (lesson.liveLessonId) {
    const [live] = await useDb().select().from(liveLessons).where(eq(liveLessons.id, lesson.liveLessonId)).limit(1)
    if (live) await cancelLiveLesson(live).catch(e => console.warn('[courses] online class not cancelled:', e?.message))
  }
  await useDb().delete(courseLessons).where(eq(courseLessons.id, lesson.id))
  return { ok: true }
})
