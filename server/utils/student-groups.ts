import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { assignments, classGroups, classMembers, liveLessons, users, vocabDeckGroups } from '../database/schema'

/**
 * A student's groups (classes): the list with what is waiting in each, and one group's page with
 * its work (and my results in it), online classes, vocabulary decks and classmates' week of XP.
 * Only members see a group; its work is shown there and nowhere else.
 */

const nameOf = (u: { name: string | null, telegramUsername: string | null, email?: string | null }) => u.name || (u.telegramUsername ? `@${u.telegramUsername}` : u.email) || 'Student'

/** The work a group set me, newest first, each with my hand-in (attempt, score or band) if any. */
async function myWork(groupId: string, userId: string, limit = 100) {
  const list = await useDb().select().from(assignments).where(eq(assignments.groupId, groupId)).orderBy(desc(assignments.createdAt)).limit(limit)
  return Promise.all(list.map(async (a) => {
    const v = await assignmentView(a, [userId])
    const mine = (await assignmentHandIns(a, [userId])).get(userId) ?? null
    return { id: v.id, skill: v.skill, partNumber: v.partNumber, note: v.note, dueAt: v.dueAt, createdAt: v.createdAt, test: v.test, to: v.to, exam: v.exam, mine }
  }))
}

/** My groups, with the teacher, how many are in it, what is still to do and the next online class. */
export async function studentGroups(userId: string) {
  const db = useDb()
  const rows = await db.select({ g: classGroups, joinedAt: classMembers.joinedAt, teacher: users.name, teacherHandle: users.telegramUsername, teacherAvatar: users.avatarUrl })
    .from(classMembers).innerJoin(classGroups, eq(classGroups.id, classMembers.groupId)).innerJoin(users, eq(users.id, classGroups.teacherId))
    .where(and(eq(classMembers.userId, userId), eq(classGroups.archived, false))).orderBy(asc(classMembers.joinedAt))
  if (!rows.length) return []
  const ids = rows.map(r => r.g.id)
  const [members, decks, next, work] = await Promise.all([
    db.select({ id: classMembers.groupId, n: count() }).from(classMembers).where(inArray(classMembers.groupId, ids)).groupBy(classMembers.groupId),
    db.select({ id: vocabDeckGroups.groupId, n: count() }).from(vocabDeckGroups).where(inArray(vocabDeckGroups.groupId, ids)).groupBy(vocabDeckGroups.groupId),
    db.select().from(liveLessons).where(and(inArray(liveLessons.groupId, ids), eq(liveLessons.status, 'SCHEDULED'),
      sql`${liveLessons.startsAt} + make_interval(mins => ${liveLessons.durationMinutes}) > now()`)).orderBy(asc(liveLessons.startsAt)),
    Promise.all(ids.map(id => myWork(id, userId, 50)))
  ])
  return rows.map((r, i) => {
    const mine = work[i]!
    const n = next.find(l => l.groupId === r.g.id)
    return {
      id: r.g.id, name: r.g.name, exam: r.g.exam, level: r.g.level, description: r.g.description, joinedAt: r.joinedAt,
      teacher: { name: r.teacher || (r.teacherHandle ? `@${r.teacherHandle}` : 'Teacher'), avatarUrl: r.teacherAvatar },
      members: members.find(m => m.id === r.g.id)?.n ?? 0,
      decks: decks.find(d => d.id === r.g.id)?.n ?? 0,
      todo: mine.filter(w => !w.mine).length,
      done: mine.filter(w => w.mine).length,
      overdue: mine.filter(w => !w.mine && w.dueAt && w.dueAt.getTime() < Date.now()).length,
      nextClass: n ? liveView(n, false) : null
    }
  })
}

/** One of my groups, or 404 (not a member, archived or gone). */
export async function requireMyGroup(userId: string, groupId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) throw createError({ statusCode: 404, message: 'Group not found' })
  const [row] = await useDb().select({ g: classGroups, joinedAt: classMembers.joinedAt }).from(classMembers)
    .innerJoin(classGroups, eq(classGroups.id, classMembers.groupId))
    .where(and(eq(classMembers.userId, userId), eq(classMembers.groupId, groupId), eq(classGroups.archived, false))).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Group not found' })
  return row
}

/** A group's page for one of its students. */
export async function studentGroup(userId: string, groupId: string) {
  const db = useDb()
  const { g, joinedAt } = await requireMyGroup(userId, groupId)
  const [[teacher], memberRows, work, live, allDecks, deckLinks, xp] = await Promise.all([
    db.select({ name: users.name, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, g.teacherId)).limit(1),
    db.select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername, avatarUrl: users.avatarUrl }).from(classMembers)
      .innerJoin(users, eq(users.id, classMembers.userId)).where(eq(classMembers.groupId, groupId)),
    myWork(groupId, userId),
    studentLiveLessons(userId),
    studentDecks(userId),
    db.select({ id: vocabDeckGroups.deckId }).from(vocabDeckGroups).where(eq(vocabDeckGroups.groupId, groupId)),
    classXpTable(groupId)
  ])
  const deckIds = new Set(deckLinks.map(d => d.id))
  // Classmates by this week's XP: only their name, picture and XP (and which one is me).
  const classmates = memberRows.filter(m => m.id !== g.teacherId)
    .map(m => ({ id: m.id, name: nameOf(m), avatarUrl: m.avatarUrl, weekXp: xp.get(m.id) ?? 0, me: m.id === userId }))
    .sort((a, b) => b.weekXp - a.weekXp || a.name.localeCompare(b.name))
  return {
    group: {
      id: g.id, name: g.name, exam: g.exam, level: g.level, description: g.description, joinedAt,
      teacher: { name: teacher ? nameOf(teacher) : 'Teacher', avatarUrl: teacher?.avatarUrl ?? null }
    },
    work,
    online: live.filter(l => l.groupId === groupId),
    decks: allDecks.filter(d => deckIds.has(d.id)),
    classmates
  }
}
