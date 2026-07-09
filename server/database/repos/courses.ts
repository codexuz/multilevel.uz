import { and, asc, eq, inArray } from 'drizzle-orm'
import { courses, courseModules, lessons, lessonProgress } from '../schema'

type Db = ReturnType<typeof useDb>

/** Public lesson shape — never includes the article body (fetched per-lesson). */
function toLessonSummary(l: typeof lessons.$inferSelect) {
  return {
    id: l.id,
    moduleId: l.moduleId,
    title: l.title,
    type: l.type,
    videoUrl: l.videoUrl,
    durationMinutes: l.durationMinutes,
    isPreview: l.isPreview,
    orderIndex: l.orderIndex
  }
}

/**
 * Full course tree (modules → lessons). `mode: 'admin'` includes lesson bodies
 * and attachments; `mode: 'student'` returns summaries only.
 */
export async function getCourseTree(db: Db, courseId: string, mode: 'admin' | 'student' = 'student') {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) return null

  const mods = await db.select().from(courseModules)
    .where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.orderIndex))
  const modIds = mods.map(m => m.id)
  const lessonRows = modIds.length
    ? await db.select().from(lessons).where(inArray(lessons.moduleId, modIds)).orderBy(asc(lessons.orderIndex))
    : []

  const lessonsByModule = new Map<string, typeof lessonRows>()
  for (const l of lessonRows) {
    const list = lessonsByModule.get(l.moduleId) ?? []
    list.push(l)
    lessonsByModule.set(l.moduleId, list)
  }

  return {
    course: {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      level: course.level,
      category: course.category,
      status: course.status,
      isPremium: course.isPremium,
      estimatedMinutes: course.estimatedMinutes
    },
    lessonCount: lessonRows.length,
    modules: mods.map(m => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      orderIndex: m.orderIndex,
      lessons: (lessonsByModule.get(m.id) ?? []).map(l =>
        mode === 'admin'
          ? {
              ...toLessonSummary(l),
              content: l.content,
              attachments: l.attachments
            }
          : toLessonSummary(l))
    }))
  }
}

/** Ordered flat list of lesson ids for a course (used for prev/next + progress). */
export async function getCourseLessonIds(db: Db, courseId: string): Promise<string[]> {
  const rows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
    .where(eq(courseModules.courseId, courseId))
    .orderBy(asc(courseModules.orderIndex), asc(lessons.orderIndex))
  return rows.map(r => r.id)
}

/** Set of completed lesson ids for a user in a course. */
export async function getCompletedLessonIds(db: Db, userId: string, courseId: string): Promise<Set<string>> {
  const rows = await db.select({ lessonId: lessonProgress.lessonId }).from(lessonProgress)
    .where(and(
      eq(lessonProgress.userId, userId),
      eq(lessonProgress.courseId, courseId),
      eq(lessonProgress.completed, true)
    ))
  return new Set(rows.map(r => r.lessonId))
}
