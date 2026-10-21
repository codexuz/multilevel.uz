import { eq } from 'drizzle-orm'
import { assignments, classMembers } from '../../../database/schema'

const SKILL_WORD: Record<string, string> = { LISTENING: 'Listening', READING: 'Reading', WRITING: 'Writing', SPEAKING: 'Speaking' }
const partName = (skill: string, n: number) => (skill === 'WRITING'
  ? ({ 1: 'Task 1.1', 2: 'Task 1.2', 3: 'Task 2' } as Record<number, string>)[n]
  : skill === 'SPEAKING' ? ({ 1: 'Part 1.1', 2: 'Part 1.2', 3: 'Part 2', 4: 'Part 3' } as Record<number, string>)[n] : undefined) ?? `Part ${n}`

// Sets the group a section of a published test (or one part of it), with an optional due date and
// note, and tells each student on Telegram.
export default defineEventHandler(async (event) => {
  const { user, group } = await requireGroupStaff(event, String(getRouterParam(event, 'id')))
  const body = (await readBody<{ testId?: string, skill?: string, partNumber?: number | null, dueAt?: string | null, note?: string }>(event)) ?? {}
  const skill = String(body.skill ?? '').toUpperCase()
  if (!SKILL_WORD[skill]) throw createError({ statusCode: 400, message: 'Pick a skill' })
  const test = await loadTest({ id: String(body.testId ?? '') }, { publishedOnly: true }).catch(() => null)
  if (!test) throw createError({ statusCode: 400, message: 'Pick a published test' })
  const section = test.sections.find((s: any) => s.skill === skill && s.items?.length)
  if (!section) throw createError({ statusCode: 400, message: `That test has no ${SKILL_WORD[skill]} section` })
  const partNumber = body.partNumber ? Math.round(Number(body.partNumber)) : null
  if (partNumber && !pickPart(section, partNumber)) throw createError({ statusCode: 400, message: 'That part is not in the test' })
  const dueAt = body.dueAt ? new Date(body.dueAt) : null
  if (dueAt && Number.isNaN(dueAt.getTime())) throw createError({ statusCode: 400, message: 'Pick a due date' })
  const note = String(body.note ?? '').trim().slice(0, 500) || null

  const [a] = await useDb().insert(assignments).values({ groupId: group.id, testId: test.id, skill, partNumber, dueAt, note, createdById: user.id }).returning()
  const members = await useDb().select({ userId: classMembers.userId }).from(classMembers).where(eq(classMembers.groupId, group.id))
  const what = `${SKILL_WORD[skill]}${partNumber ? ` ${partName(skill, partNumber)}` : ''} of ${test.title}`
  const due = dueAt ? `\nDue ${dueAt.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })}.` : ''
  const path = `/tests/${test.slug}/${skill.toLowerCase()}${partNumber ? `?part=${partNumber}` : ''}`
  for (const m of members) {
    await notifyTelegram(m.userId, { text: `📚 <b>New work from ${group.name}</b>\n${what}.${due}${note ? `\n\n${note.replace(/[<>&]/g, '')}` : ''}`, path, button: 'Start' }).catch(() => false)
  }
  return a
})
