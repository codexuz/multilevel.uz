import { count, desc, eq, inArray } from 'drizzle-orm'
import { courseEnrollments, courseLessons, courseModules, courses, lessonExercises, users } from '../../../database/schema'

// Lists all LMS courses across all teachers for the Admin Panel.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const q = String(getQuery(event).q ?? '').trim().toLowerCase()
  const rows = await db.select().from(courses).orderBy(desc(courses.updatedAt)).limit(200)
  const filtered = q ? rows.filter(c => c.title.toLowerCase().includes(q) || (c.summary ?? '').toLowerCase().includes(q)) : rows
  if (!filtered.length) return { courses: [] }

  const ids = filtered.map(c => c.id)
  const teacherIds = [...new Set(filtered.map(c => c.teacherId))]
  const [teachers, modCounts, lessonCounts, exCounts, learnerCounts] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, teacherIds)),
    db.select({ id: courseModules.courseId, n: count() }).from(courseModules).where(inArray(courseModules.courseId, ids)).groupBy(courseModules.courseId),
    db.select({ id: courseLessons.courseId, n: count() }).from(courseLessons).where(inArray(courseLessons.courseId, ids)).groupBy(courseLessons.courseId),
    db.select({ courseId: courseLessons.courseId, n: count() }).from(lessonExercises).innerJoin(courseLessons, eq(courseLessons.id, lessonExercises.lessonId)).where(inArray(courseLessons.courseId, ids)).groupBy(courseLessons.courseId),
    db.select({ id: courseEnrollments.courseId, n: count() }).from(courseEnrollments).where(inArray(courseEnrollments.courseId, ids)).groupBy(courseEnrollments.courseId)
  ])

  return {
    courses: filtered.map((c) => {
      const t = teachers.find(x => x.id === c.teacherId)
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        exam: c.exam,
        level: c.level,
        visibility: c.visibility,
        published: c.published,
        dripMode: c.dripMode,
        modules: modCounts.find(x => x.id === c.id)?.n ?? 0,
        lessons: lessonCounts.find(x => x.id === c.id)?.n ?? 0,
        exercises: exCounts.find(x => x.courseId === c.id)?.n ?? 0,
        learners: learnerCounts.find(x => x.id === c.id)?.n ?? 0,
        teacher: t ? { id: t.id, name: t.name || (t.telegramUsername ? `@${t.telegramUsername}` : t.email) || 'Teacher', avatarUrl: t.avatarUrl } : null,
        updatedAt: c.updatedAt
      }
    })
  }
})
