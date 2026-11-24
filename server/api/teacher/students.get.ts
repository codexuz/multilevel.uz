import { and, desc, eq, inArray } from 'drizzle-orm'
import { attempts, classGroups, classMembers, exerciseAttempts, users } from '../../database/schema'

const nameOf = (u: { name: string | null, telegramUsername: string | null, email: string | null }) =>
  u.name || (u.telegramUsername ? `@${u.telegramUsername}` : u.email) || 'Student'

// Unified student roster across all of the teacher's active groups.
export default defineEventHandler(async (event) => {
  const user = await requireTeacher(event)
  const db = useDb()
  const groups = await db.select().from(classGroups).where(and(eq(classGroups.teacherId, user.id), eq(classGroups.archived, false)))
  if (!groups.length) return { students: [], groups: [] }

  const groupIds = groups.map(g => g.id)
  const memberships = await db.select().from(classMembers).where(inArray(classMembers.groupId, groupIds))
  const studentIds = [...new Set(memberships.map(m => m.userId).filter(id => id !== user.id))]
  if (!studentIds.length) return { students: [], groups: groups.map(g => ({ id: g.id, name: g.name, level: g.level })) }

  const [userRows, attemptRows, exRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl, currentLevel: users.currentLevel, targetLevel: users.targetLevel }).from(users).where(inArray(users.id, studentIds)),
    db.select({ userId: attempts.userId, exam: attempts.exam, score: attempts.score, band: attempts.band, submittedAt: attempts.submittedAt }).from(attempts).where(inArray(attempts.userId, studentIds)).orderBy(desc(attempts.submittedAt)).limit(3000),
    db.select({ userId: exerciseAttempts.userId, score: exerciseAttempts.score, passed: exerciseAttempts.passed, submittedAt: exerciseAttempts.submittedAt }).from(exerciseAttempts).where(inArray(exerciseAttempts.userId, studentIds)).orderBy(desc(exerciseAttempts.submittedAt)).limit(3000)
  ])

  const gMap = new Map(groups.map(g => [g.id, g]))
  return {
    groups: groups.map(g => ({ id: g.id, name: g.name, level: g.level })),
    students: userRows.map((u) => {
      const myGroups = memberships.filter(m => m.userId === u.id).map(m => gMap.get(m.groupId)).filter(Boolean).map(g => ({ id: g!.id, name: g!.name, level: g!.level }))
      const myAttempts = attemptRows.filter(a => a.userId === u.id)
      const myEx = exRows.filter(e => e.userId === u.id)
      const avgExercise = myEx.length ? Math.round(myEx.reduce((s, e) => s + e.score, 0) / myEx.length) : null
      const lastActive = [myAttempts[0]?.submittedAt, myEx[0]?.submittedAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
      return {
        id: u.id,
        name: nameOf(u),
        email: u.email,
        telegramUsername: u.telegramUsername,
        avatarUrl: u.avatarUrl,
        level: u.currentLevel || u.targetLevel || null,
        groups: myGroups,
        examAttempts: myAttempts.length,
        exerciseAttempts: myEx.length,
        avgExerciseScore: avgExercise,
        lastActive
      }
    }).sort((a, b) => (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0))
  }
})
