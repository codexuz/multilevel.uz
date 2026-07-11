import { and, eq } from 'drizzle-orm'
import { lessons, courseModules, enrollments, lessonProgress } from '../../../../database/schema'

// YouTube/Vimeo are embedded client-side; anything else is served through the
// gated /video stream so the real source URL never reaches the browser.
const EMBED_RE = /(?:youtube\.com|youtu\.be|vimeo\.com)/i

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const courseId = getRouterParam(event, 'id')!
  const lessonId = getRouterParam(event, 'lessonId')!
  const db = useDb()

  // Join to the module so we can confirm the lesson belongs to this course.
  const [lesson] = await db.select({
    id: lessons.id,
    moduleId: lessons.moduleId,
    title: lessons.title,
    type: lessons.type,
    content: lessons.content,
    videoUrl: lessons.videoUrl,
    attachments: lessons.attachments,
    durationMinutes: lessons.durationMinutes,
    isPreview: lessons.isPreview,
    orderIndex: lessons.orderIndex,
    courseId: courseModules.courseId
  }).from(lessons)
    .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
    .where(and(eq(lessons.id, lessonId), eq(courseModules.courseId, courseId)))
    .limit(1)

  if (!lesson) throw createError({ statusCode: 404, message: 'Lesson not found' })

  const [enrollment] = await db.select({ id: enrollments.id }).from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))).limit(1)

  if (!enrollment && !lesson.isPreview) {
    throw createError({ statusCode: 403, message: 'Enroll to access this lesson' })
  }

  // Track "last viewed" lesson for resume.
  if (enrollment) {
    await db.update(enrollments).set({ lastLessonId: lessonId }).where(eq(enrollments.id, enrollment.id))
  }

  const [prog] = await db.select({ completed: lessonProgress.completed }).from(lessonProgress)
    .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, lessonId))).limit(1)

  const videoUrl = lesson.videoUrl
    ? (EMBED_RE.test(lesson.videoUrl)
        ? lesson.videoUrl
        : `/api/courses/${courseId}/lessons/${lessonId}/video`)
    : null

  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    courseId: lesson.courseId,
    title: lesson.title,
    type: lesson.type,
    content: lesson.content,
    videoUrl,
    attachments: lesson.attachments,
    durationMinutes: lesson.durationMinutes,
    isPreview: lesson.isPreview,
    completed: !!prog?.completed,
    enrolled: !!enrollment
  }
})
