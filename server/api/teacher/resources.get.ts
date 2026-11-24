import { desc, eq, inArray } from 'drizzle-orm'
import { courseLessons, courses, exerciseQuestions, lessonExercises } from '../../database/schema'

// Lists all uploaded PDFs, videos, and exercise audio across the teacher's LMS courses.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()
  const myCourses = await db.select({ id: courses.id, title: courses.title, slug: courses.slug }).from(courses).where(eq(courses.teacherId, user.id)).orderBy(desc(courses.updatedAt))
  if (!myCourses.length) return { resources: [] }

  const cMap = new Map(myCourses.map(c => [c.id, c]))
  const lessons = await db.select().from(courseLessons).where(inArray(courseLessons.courseId, myCourses.map(c => c.id)))
  const lessonIds = lessons.map(l => l.id)
  const audioQuestions = lessonIds.length
    ? await db.select({
        audioRef: exerciseQuestions.audioRef,
        prompt: exerciseQuestions.prompt,
        lessonId: lessonExercises.lessonId,
        createdAt: exerciseQuestions.createdAt
      }).from(exerciseQuestions)
        .innerJoin(lessonExercises, eq(lessonExercises.id, exerciseQuestions.exerciseId))
        .where(inArray(lessonExercises.lessonId, lessonIds))
    : []

  const resources: Array<{ id: string, kind: 'PDF' | 'VIDEO' | 'AUDIO', name: string, url: string, size: number | null, courseTitle: string, courseId: string, lessonTitle: string, createdAt: Date }> = []

  for (const l of lessons) {
    const c = cMap.get(l.courseId)
    if (!c) continue
    if (l.videoUrl) {
      resources.push({ id: `video-${l.id}`, kind: 'VIDEO', name: `${l.title} (Video)`, url: l.videoUrl, size: null, courseTitle: c.title, courseId: c.id, lessonTitle: l.title, createdAt: l.updatedAt })
    }
    const files = Array.isArray(l.files) ? l.files as Array<{ name: string, url: string, size?: number | null }> : []
    for (const [idx, f] of files.entries()) {
      resources.push({ id: `file-${l.id}-${idx}`, kind: 'PDF', name: f.name || 'PDF Handout', url: f.url, size: f.size ?? null, courseTitle: c.title, courseId: c.id, lessonTitle: l.title, createdAt: l.updatedAt })
    }
  }

  const lMap = new Map(lessons.map(l => [l.id, l]))
  for (const [idx, q] of audioQuestions.entries()) {
    if (!q.audioRef) continue
    const l = lMap.get(q.lessonId)
    const c = l ? cMap.get(l.courseId) : null
    if (!l || !c) continue
    resources.push({ id: `audio-${idx}`, kind: 'AUDIO', name: q.prompt?.slice(0, 60) || 'Dictation Audio', url: q.audioRef, size: null, courseTitle: c.title, courseId: c.id, lessonTitle: l.title, createdAt: q.createdAt })
  }

  return { resources: resources.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) }
})
