import { and, count, desc, eq, ilike, inArray, max, ne, or, sql } from 'drizzle-orm'
import {
  answers, attempts, essays, parts, questionGroups, questionItems, sectionItems, sections,
  speakingParts, speakingQuestions, speakingResponses, tests, writingTasks
} from '../database/schema'

/**
 * The test library and the tests built from it, as in the erp-lms IELTS addon
 * (ielts-content.service.ts). Parts, writing tasks and speaking parts are written once and placed
 * into any number of tests. Changing one that candidates already answered is refused where it
 * would lose their answers, and allowed where it would not.
 */

type Body = Record<string, any>

const paging = (query: Body, maxLimit = 100) => {
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query.limit) || 20)))
  return { page, limit, offset: (page - 1) * limit }
}
export const paged = <T>(items: T[], total: number, page: number, limit: number) =>
  ({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) })
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const optional = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value)
const bad = (message: string) => createError({ statusCode: 400, message })
const conflict = (message: string) => createError({ statusCode: 409, message })
const notFound = (message: string) => createError({ statusCode: 404, message })

// ─── Parts ───────────────────────────────────────────────────────────────────────────────

export async function listParts(query: Body) {
  const db = useDb()
  const { page, limit, offset } = paging(query)
  const where = and(
    query.skill ? eq(parts.skill, String(query.skill)) : undefined,
    query.partNumber ? eq(parts.partNumber, Number(query.partNumber)) : undefined,
    query.difficulty ? eq(parts.difficulty, String(query.difficulty)) : undefined,
    query.search?.trim() ? ilike(parts.title, `%${query.search.trim()}%`) : undefined
  )
  const [rows, [total]] = await Promise.all([
    db.query.parts.findMany({ where, limit, offset, orderBy: [desc(parts.updatedAt)], with: { groups: { with: { items: { columns: { id: true } } } } } }),
    db.select({ n: count() }).from(parts).where(where)
  ])
  const placed = rows.length
    ? await db.select({ partId: sectionItems.partId, testId: tests.id, title: tests.title, status: tests.status, skill: sections.skill })
        .from(sectionItems).innerJoin(sections, eq(sections.id, sectionItems.sectionId)).innerJoin(tests, eq(tests.id, sections.testId))
        .where(inArray(sectionItems.partId, rows.map(r => r.id)))
    : []
  return paged(rows.map(({ groups, passage, ...rest }) => ({
    ...rest,
    audioUrl: sign(rest.audioRef),
    questionCount: groups.reduce((sum, g) => sum + g.items.length, 0),
    types: [...new Set(groups.map(g => g.type))],
    excerpt: passage ? passage.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) : null,
    tests: placed.filter(p => p.partId === rest.id).map(p => ({ id: p.testId, title: p.title, status: p.status }))
  })), total?.n ?? 0, page, limit)
}

async function partRow(id: string) {
  const db = useDb()
  const part = await db.query.parts.findFirst({
    where: eq(parts.id, id),
    with: { groups: { orderBy: (t, { asc }) => [asc(t.position)], with: { items: { orderBy: (t, { asc }) => [asc(t.position), asc(t.number)] } } } }
  })
  if (!part) throw notFound('Part not found')
  return part
}

async function answeredInPart(partId: string) {
  const db = useDb()
  const [row] = await db.select({ n: count() }).from(answers)
    .innerJoin(questionItems, eq(questionItems.id, answers.itemId))
    .innerJoin(questionGroups, eq(questionGroups.id, questionItems.groupId))
    .where(eq(questionGroups.partId, partId))
  return row?.n ?? 0
}

export async function getPart(id: string) {
  const db = useDb()
  const part = await partRow(id)
  const placed = await db.select({ id: tests.id, title: tests.title, status: tests.status })
    .from(sectionItems).innerJoin(sections, eq(sections.id, sectionItems.sectionId)).innerJoin(tests, eq(tests.id, sections.testId))
    .where(eq(sectionItems.partId, id))
  return { ...partView(part, true), tests: placed, answered: await answeredInPart(id) }
}

function checkPartNumber(skill: string, partNumber: number) {
  const limit = skill === 'READING' ? FORMAT.READING.parts : FORMAT.LISTENING.parts
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > limit) throw bad(`${skill === 'READING' ? 'Reading' : 'Listening'} has parts 1–${limit}`)
}

export async function createPart(body: Body, userId: string) {
  if (body.skill !== 'LISTENING' && body.skill !== 'READING') throw bad('A part is Listening or Reading')
  checkPartNumber(body.skill, Number(body.partNumber))
  const db = useDb()
  const [part] = await db.insert(parts).values({
    skill: body.skill, partNumber: Number(body.partNumber), title: text(body.title),
    passage: body.skill === 'READING' ? body.passage ?? null : null,
    audioRef: body.skill === 'LISTENING' ? body.audioRef ?? null : null,
    transcriptRef: body.skill === 'LISTENING' ? body.transcriptRef ?? null : null,
    difficulty: body.difficulty ?? null, timeLimitMinutes: body.timeLimitMinutes ?? null, isActive: body.isActive ?? true, createdById: userId
  }).returning({ id: parts.id })
  return getPart(part!.id)
}

export async function updatePart(id: string, body: Body) {
  const part = await partRow(id)
  if (body.partNumber) checkPartNumber(part.skill, Number(body.partNumber))
  const db = useDb()
  await db.update(parts).set({
    ...(body.partNumber ? { partNumber: Number(body.partNumber) } : {}),
    ...(body.title !== undefined ? { title: text(body.title) } : {}),
    ...(body.passage !== undefined && part.skill === 'READING' ? { passage: body.passage } : {}),
    ...(body.audioRef !== undefined && part.skill === 'LISTENING' ? { audioRef: body.audioRef } : {}),
    ...(body.transcriptRef !== undefined && part.skill === 'LISTENING' ? { transcriptRef: body.transcriptRef } : {}),
    ...(body.difficulty !== undefined ? { difficulty: body.difficulty } : {}),
    ...(body.timeLimitMinutes !== undefined ? { timeLimitMinutes: body.timeLimitMinutes } : {}),
    ...(body.isActive !== undefined ? { isActive: !!body.isActive } : {})
  }).where(eq(parts.id, id))
  return getPart(id)
}

/** A part somebody has answered is hidden rather than deleted, so their results keep their questions. */
export async function deletePart(id: string) {
  await partRow(id)
  const db = useDb()
  if (await answeredInPart(id)) {
    await db.update(parts).set({ isActive: false }).where(eq(parts.id, id))
    return { deleted: false, archived: true }
  }
  await db.delete(parts).where(eq(parts.id, id))
  return { deleted: true }
}

// ─── Question groups ─────────────────────────────────────────────────────────────────────

interface GroupBody {
  type: string
  instruction?: string | null
  context?: string | null
  content?: Record<string, any>
  explanation?: string | null
  position?: number
  items: { id?: string, number: number, prompt?: string | null, acceptedAnswers: string[], explanation?: string | null, evidence?: string | null, points?: number }[]
}

function checkGroup(body: GroupBody) {
  if (!body || !IELTS_QUESTION_TYPES[body.type]) throw bad('Unknown question type')
  if (!Array.isArray(body.items) || !body.items.length) throw bad('A group needs at least one question')
  const numbers = body.items.map(item => Number(item.number))
  if (numbers.some(n => !Number.isInteger(n) || n < 1)) throw bad('Every question needs a number')
  const doubled = numbers.filter((n, i) => numbers.indexOf(n) !== i)
  if (doubled.length) throw bad(`Questions ${[...new Set(doubled)].join(', ')} appear twice`)
  const kind = kindOf(body.type)
  const keyed = [...(body.content?.options ?? []), ...(body.content?.headings ?? [])]
  const keys = new Set(keyed.map((o: any) => String(o?.key ?? '').trim().toLowerCase()).filter(Boolean))
  if ((kind === 'CHOICE' || kind === 'MULTI') && keys.size) {
    for (const item of body.items) {
      for (const answer of alternativesOf(item.acceptedAnswers)) {
        if (!keys.has(answer.trim().toLowerCase())) throw bad(`Question ${item.number}: "${answer}" is not one of the options`)
      }
    }
  }
  if (kind === 'TFNG' || kind === 'YNNG') {
    const allowed = kind === 'TFNG' ? ['true', 'false', 'not given'] : ['yes', 'no', 'not given']
    for (const item of body.items) {
      for (const answer of item.acceptedAnswers ?? []) {
        if (!allowed.includes(String(answer).trim().toLowerCase())) throw bad(`Question ${item.number}: the answer is ${allowed.join(' / ').toUpperCase()}`)
      }
    }
  }
}

/** Numbers must not collide with another group of the same part. */
async function checkNumbersFree(partId: string, numbers: number[], exceptGroupId?: string) {
  const db = useDb()
  const taken = await db.select({ number: questionItems.number }).from(questionItems)
    .innerJoin(questionGroups, eq(questionGroups.id, questionItems.groupId))
    .where(and(eq(questionGroups.partId, partId), inArray(questionItems.number, numbers), exceptGroupId ? ne(questionGroups.id, exceptGroupId) : undefined))
  if (taken.length) throw bad(`Questions ${[...new Set(taken.map(t => t.number))].join(', ')} are already in this part`)
}

const itemValues = (item: GroupBody['items'][number], index: number) => ({
  number: Number(item.number), position: index + 1, prompt: item.prompt ?? null,
  acceptedAnswers: alternativesOf(item.acceptedAnswers).map(a => a.trim()).filter(Boolean),
  explanation: item.explanation ?? null, evidence: item.evidence ?? null, points: item.points ?? 1
})

export async function createGroup(partId: string, body: GroupBody) {
  checkGroup(body)
  await partRow(partId)
  await checkNumbersFree(partId, body.items.map(item => Number(item.number)))
  const db = useDb()
  await db.transaction(async (tx) => {
    const [last] = await tx.select({ n: max(questionGroups.position) }).from(questionGroups).where(eq(questionGroups.partId, partId))
    const [group] = await tx.insert(questionGroups).values({
      partId, position: body.position ?? (last?.n ?? 0) + 1, type: body.type, instruction: body.instruction ?? null,
      context: body.context ?? null, content: body.content ?? {}, explanation: body.explanation ?? null
    }).returning({ id: questionGroups.id })
    await tx.insert(questionItems).values(body.items.map((item, i) => ({ ...itemValues(item, i), groupId: group!.id })))
  })
  return getPart(partId)
}

/** Saves a group as the editor holds it. Items are matched by id; one somebody answered is never dropped. */
export async function updateGroup(groupId: string, body: GroupBody) {
  checkGroup(body)
  const db = useDb()
  const group = await db.query.questionGroups.findFirst({ where: eq(questionGroups.id, groupId), with: { items: true } })
  if (!group) throw notFound('Question group not found')
  await checkNumbersFree(group.partId, body.items.map(item => Number(item.number)), groupId)
  const kept = new Set(body.items.map(item => item.id).filter(Boolean))
  const dropped = group.items.filter(item => !kept.has(item.id)).map(item => item.id)
  if (dropped.length) {
    const [used] = await db.select({ n: count() }).from(answers).where(inArray(answers.itemId, dropped))
    if (used?.n) throw conflict('Candidates answered the questions being removed. Edit them instead of removing them.')
  }
  await db.transaction(async (tx) => {
    await tx.update(questionGroups).set({
      type: body.type, instruction: body.instruction ?? null, context: body.context ?? null,
      content: body.content ?? {}, explanation: body.explanation ?? null, ...(body.position ? { position: body.position } : {})
    }).where(eq(questionGroups.id, groupId))
    if (dropped.length) await tx.delete(questionItems).where(inArray(questionItems.id, dropped))
    const existing = new Set(group.items.map(item => item.id))
    for (const [index, item] of body.items.entries()) {
      const values = itemValues(item, index)
      if (item.id && existing.has(item.id)) await tx.update(questionItems).set(values).where(eq(questionItems.id, item.id))
      else await tx.insert(questionItems).values({ ...values, groupId })
    }
  })
  return getPart(group.partId)
}

export async function deleteGroup(groupId: string) {
  const db = useDb()
  const group = await db.query.questionGroups.findFirst({ where: eq(questionGroups.id, groupId) })
  if (!group) throw notFound('Question group not found')
  const [used] = await db.select({ n: count() }).from(answers).innerJoin(questionItems, eq(questionItems.id, answers.itemId)).where(eq(questionItems.groupId, groupId))
  if (used?.n) throw conflict('Candidates answered these questions')
  await db.delete(questionGroups).where(eq(questionGroups.id, groupId))
  return getPart(group.partId)
}

export async function reorderGroups(partId: string, ids: string[]) {
  const part = await partRow(partId)
  const own = new Set(part.groups.map(group => group.id))
  if (!Array.isArray(ids) || ids.length !== own.size || ids.some(id => !own.has(id))) throw bad('The list of groups is incomplete')
  const db = useDb()
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) await tx.update(questionGroups).set({ position: index + 1 }).where(eq(questionGroups.id, id))
  })
  return getPart(partId)
}

// ─── Writing tasks ───────────────────────────────────────────────────────────────────────

export async function listWritingTasks(query: Body) {
  const db = useDb()
  const { page, limit, offset } = paging(query)
  const search = query.search?.trim()
  const where = and(
    query.taskNumber ? eq(writingTasks.taskNumber, Number(query.taskNumber)) : undefined,
    search ? or(ilike(writingTasks.title, `%${search}%`), ilike(writingTasks.prompt, `%${search}%`)) : undefined
  )
  const [rows, [total]] = await Promise.all([
    db.select({ task: writingTasks, essays: sql<number>`(select count(*)::int from ${essays} where ${essays.taskId} = ${writingTasks.id})` })
      .from(writingTasks).where(where).orderBy(desc(writingTasks.updatedAt)).limit(limit).offset(offset),
    db.select({ n: count() }).from(writingTasks).where(where)
  ])
  return paged(rows.map(r => ({ ...writingTaskView(r.task), essays: r.essays })), total?.n ?? 0, page, limit)
}

async function writingTaskRow(id: string) {
  const db = useDb()
  const [task] = await db.select().from(writingTasks).where(eq(writingTasks.id, id)).limit(1)
  if (!task) throw notFound('Writing task not found')
  return task
}

export const getWritingTask = async (id: string) => writingTaskView(await writingTaskRow(id))

function checkTaskNumber(n: number) {
  if (![1, 2, 3].includes(n)) throw bad('Writing tasks are 1 (Task 1.1), 2 (Task 1.2) and 3 (Task 2)')
}

export async function createWritingTask(body: Body, userId: string) {
  checkTaskNumber(Number(body.taskNumber))
  if (!text(body.prompt)) throw bad('The task needs its question')
  const db = useDb()
  const [task] = await db.insert(writingTasks).values({
    taskNumber: Number(body.taskNumber), module: body.module ?? null, title: text(body.title), prompt: body.prompt,
    imageRef: body.imageRef ?? null, minWords: body.minWords ?? null, suggestedMinutes: body.suggestedMinutes ?? null, createdById: userId
  }).returning({ id: writingTasks.id })
  return getWritingTask(task!.id)
}

export async function updateWritingTask(id: string, body: Body) {
  const task = await writingTaskRow(id)
  if (body.taskNumber !== undefined) checkTaskNumber(Number(body.taskNumber))
  const db = useDb()
  await db.update(writingTasks).set({
    taskNumber: optional(body.taskNumber === undefined ? undefined : Number(body.taskNumber), task.taskNumber),
    title: body.title !== undefined ? text(body.title) : task.title,
    prompt: optional(body.prompt, task.prompt),
    imageRef: optional(body.imageRef, task.imageRef),
    minWords: optional(body.minWords, task.minWords),
    suggestedMinutes: optional(body.suggestedMinutes, task.suggestedMinutes)
  }).where(eq(writingTasks.id, id))
  return getWritingTask(id)
}

export async function deleteWritingTask(id: string) {
  await writingTaskRow(id)
  const db = useDb()
  const [used] = await db.select({ n: count() }).from(essays).where(eq(essays.taskId, id))
  if (used?.n) throw conflict('Essays were written to this task: it cannot be deleted')
  await db.delete(writingTasks).where(eq(writingTasks.id, id))
  return { deleted: true }
}

// ─── Speaking parts ──────────────────────────────────────────────────────────────────────

export async function listSpeakingParts(query: Body) {
  const db = useDb()
  const { page, limit, offset } = paging(query)
  const search = query.search?.trim()
  const where = and(
    query.partNumber ? eq(speakingParts.partNumber, Number(query.partNumber)) : undefined,
    search ? or(ilike(speakingParts.title, `%${search}%`), ilike(speakingParts.cueCard, `%${search}%`)) : undefined
  )
  const [rows, [total]] = await Promise.all([
    db.query.speakingParts.findMany({ where, limit, offset, orderBy: [desc(speakingParts.updatedAt)], with: { questions: { orderBy: (t, { asc }) => [asc(t.position)] } } }),
    db.select({ n: count() }).from(speakingParts).where(where)
  ])
  return paged(rows.map(speakingPartView), total?.n ?? 0, page, limit)
}

export async function getSpeakingPart(id: string) {
  const db = useDb()
  const part = await db.query.speakingParts.findFirst({ where: eq(speakingParts.id, id), with: { questions: { orderBy: (t, { asc }) => [asc(t.position)] } } })
  if (!part) throw notFound('Speaking part not found')
  return speakingPartView(part)
}

export async function saveSpeakingPart(id: string | null, body: Body, userId: string) {
  const partNumber = Number(body.partNumber)
  if (![1, 2, 3, 4].includes(partNumber)) throw bad('Speaking parts are 1 (Part 1.1), 2 (Part 1.2), 3 (Part 2) and 4 (Part 3)')
  const values = {
    partNumber, title: text(body.title), cueCard: body.cueCard ?? null, imageRef: body.imageRef ?? null,
    prepSeconds: body.prepSeconds ?? null, speakSeconds: body.speakSeconds ?? null
  }
  const questions = (Array.isArray(body.questions) ? body.questions : []).map((q: unknown) => String(q).trim()).filter(Boolean)
  const db = useDb()
  const saved = await db.transaction(async (tx) => {
    if (id) {
      await getSpeakingPart(id)
      await tx.update(speakingParts).set(values).where(eq(speakingParts.id, id))
      await tx.delete(speakingQuestions).where(eq(speakingQuestions.partId, id))
      if (questions.length) await tx.insert(speakingQuestions).values(questions.map((t: string, i: number) => ({ partId: id, text: t, position: i + 1 })))
      return id
    }
    const [part] = await tx.insert(speakingParts).values({ ...values, createdById: userId }).returning({ id: speakingParts.id })
    if (questions.length) await tx.insert(speakingQuestions).values(questions.map((t: string, i: number) => ({ partId: part!.id, text: t, position: i + 1 })))
    return part!.id
  })
  return getSpeakingPart(saved)
}

export async function deleteSpeakingPart(id: string) {
  await getSpeakingPart(id)
  const db = useDb()
  const [used] = await db.select({ n: count() }).from(speakingResponses).where(eq(speakingResponses.partId, id))
  if (used?.n) throw conflict('Candidates recorded answers to this part: it cannot be deleted')
  await db.delete(speakingParts).where(eq(speakingParts.id, id))
  return { deleted: true }
}

// ─── Tests ───────────────────────────────────────────────────────────────────────────────

const SKILL_NAMES = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']

/**
 * The catalogue's filters on tests: has a section in a skill, has questions of a type, is a full
 * test (all four skills), free or premium.
 */
function catalogFilters(query: Body) {
  const skill = SKILL_NAMES.includes(String(query.skill)) ? String(query.skill) : null
  const type = query.type && IELTS_QUESTION_TYPES[String(query.type)] ? String(query.type) : null
  return [
    skill ? sql`exists (select 1 from ${sections} s join ${sectionItems} si on si.section_id = s.id where s.test_id = ${tests.id} and s.skill = ${skill})` : undefined,
    type ? sql`exists (select 1 from ${sections} s join ${sectionItems} si on si.section_id = s.id join ${questionGroups} g on g.part_id = si.part_id where s.test_id = ${tests.id} and g.type = ${type})` : undefined,
    query.access === 'FREE' || query.access === 'PREMIUM' ? eq(tests.access, String(query.access)) : undefined
  ]
}

/** A full test: it has all four skills, each with something in it. */
const FULL_TEST = sql`(select count(distinct s.skill) from ${sections} s where s.test_id = ${tests.id} and exists (select 1 from ${sectionItems} si where si.section_id = s.id)) = 4`
const wantsFull = (query: Body) => query.full === '1' || query.full === 'true'

/**
 * The parts of published tests, each to practise on its own: Listening and Reading parts, Writing
 * tasks and Speaking parts, with what they hold. Filtered by skill, number, question type and words.
 */
export async function listPracticeParts(query: Body) {
  const db = useDb()
  const { page, limit, offset } = paging(query, 60)
  const skill = SKILL_NAMES.includes(String(query.skill)) ? String(query.skill) : null
  const number = Number(query.part) || null
  const type = query.type && IELTS_QUESTION_TYPES[String(query.type)] ? String(query.type) : null
  const search = query.search?.trim()
  const itemNo = sql<number>`coalesce(${parts.partNumber}, ${writingTasks.taskNumber}, ${speakingParts.partNumber})`
  const where = and(
    eq(tests.status, 'PUBLISHED'),
    skill ? eq(sections.skill, skill) : undefined,
    number ? sql`${itemNo} = ${number}` : undefined,
    type ? sql`exists (select 1 from ${questionGroups} g where g.part_id = ${sectionItems.partId} and g.type = ${type})` : undefined,
    query.access === 'FREE' || query.access === 'PREMIUM' ? eq(tests.access, String(query.access)) : undefined,
    search ? or(ilike(parts.title, `%${search}%`), ilike(writingTasks.title, `%${search}%`), ilike(speakingParts.title, `%${search}%`), ilike(tests.title, `%${search}%`)) : undefined
  )
  const base = () => db.select().from(sectionItems)
    .innerJoin(sections, eq(sections.id, sectionItems.sectionId))
    .innerJoin(tests, eq(tests.id, sections.testId))
    .leftJoin(parts, eq(parts.id, sectionItems.partId))
    .leftJoin(writingTasks, eq(writingTasks.id, sectionItems.writingTaskId))
    .leftJoin(speakingParts, eq(speakingParts.id, sectionItems.speakingPartId))
  const [rows, [total]] = await Promise.all([
    base().where(where).orderBy(desc(tests.publishedAt), sections.position, sectionItems.position).limit(limit).offset(offset),
    db.select({ n: count() }).from(sectionItems)
      .innerJoin(sections, eq(sections.id, sectionItems.sectionId))
      .innerJoin(tests, eq(tests.id, sections.testId))
      .leftJoin(parts, eq(parts.id, sectionItems.partId))
      .leftJoin(writingTasks, eq(writingTasks.id, sectionItems.writingTaskId))
      .leftJoin(speakingParts, eq(speakingParts.id, sectionItems.speakingPartId))
      .where(where)
  ])
  // What each Listening or Reading part asks: its question types and how many questions.
  const partIds = rows.map(r => r.parts?.id).filter((id): id is string => !!id)
  const groups = partIds.length
    ? await db.select({ partId: questionGroups.partId, type: questionGroups.type, n: count(questionItems.id) }).from(questionGroups)
        .leftJoin(questionItems, eq(questionItems.groupId, questionGroups.id))
        .where(inArray(questionGroups.partId, partIds)).groupBy(questionGroups.partId, questionGroups.type)
    : []
  const items = rows.map((r) => {
    const own = groups.filter(g => g.partId === r.parts?.id)
    return {
      id: r.section_items.id,
      skill: r.sections.skill,
      number: r.parts?.partNumber ?? r.writing_tasks?.taskNumber ?? r.speaking_parts?.partNumber ?? null,
      title: r.parts?.title ?? r.writing_tasks?.title ?? r.speaking_parts?.title ?? null,
      questions: own.reduce((n, g) => n + g.n, 0),
      types: [...new Set(own.map(g => g.type))],
      minWords: r.writing_tasks ? minimumWordsFor(r.writing_tasks.taskNumber, r.writing_tasks.minWords) : null,
      test: { id: r.tests.id, slug: r.tests.slug, title: r.tests.title, access: r.tests.access }
    }
  })
  return paged(items, total?.n ?? 0, page, limit)
}

export async function listTests(query: Body, opts: { publishedOnly?: boolean } = {}) {
  const db = useDb()
  const { page, limit, offset } = paging(query, opts.publishedOnly ? 60 : 100)
  const search = query.search?.trim()
  const others = and(
    opts.publishedOnly ? eq(tests.status, 'PUBLISHED') : query.status ? eq(tests.status, String(query.status)) : ne(tests.status, 'ARCHIVED'),
    query.mode ? eq(tests.mode, String(query.mode)) : undefined,
    query.category ? eq(tests.category, String(query.category)) : undefined,
    search ? or(ilike(tests.title, `%${search}%`), ilike(tests.description, `%${search}%`)) : undefined,
    ...catalogFilters(query)
  )
  const where = wantsFull(query) ? and(others, FULL_TEST) : others
  const [rows, [total], [full]] = await Promise.all([
    db.query.tests.findMany({
      where, limit, offset,
      orderBy: opts.publishedOnly ? [desc(tests.publishedAt)] : [desc(tests.updatedAt)],
      with: { sections: { orderBy: (t, { asc }) => [asc(t.position)], with: { items: { with: { part: { with: { groups: { with: { items: { columns: { id: true } } } } } } } } } } }
    }),
    db.select({ n: count() }).from(tests).where(where),
    // How many of the tests the other filters allow are full tests, for the catalogue's switch.
    db.select({ n: count() }).from(tests).where(and(others, FULL_TEST))
  ])
  const counts = !opts.publishedOnly && rows.length
    ? new Map((await db.select({ testId: attempts.testId, n: count() }).from(attempts).where(inArray(attempts.testId, rows.map(r => r.id))).groupBy(attempts.testId)).map(r => [r.testId, r.n]))
    : new Map()
  return { ...paged(rows.map(row => ({ ...testSummary(row), ...(opts.publishedOnly ? {} : { attempts: counts.get(row.id) ?? 0 }) })), total?.n ?? 0, page, limit), fullTests: full?.n ?? 0 }
}

/** The whole test as its author edits it: every section, item and key. */
export async function getTest(id: string) {
  const db = useDb()
  const test = await loadTest({ id })
  const [row] = await db.select({ n: count() }).from(attempts).where(eq(attempts.testId, id))
  return { ...testView(test, true), attempts: row?.n ?? 0, readiness: readiness(test) }
}

const MODES = ['PRACTICE', 'MOCK']
const CATEGORIES = ['AUTHENTIC', 'CAMBRIDGE', 'PRE_TEST', 'CUSTOM']

export async function createTest(body: Body, userId: string) {
  const title = text(body.title)
  if (!title) throw bad('The test needs a title')
  const db = useDb()
  const [test] = await db.insert(tests).values({
    slug: await uniqueSlug(title), title, description: text(body.description),
    mode: MODES.includes(body.mode) ? body.mode : 'PRACTICE', category: CATEGORIES.includes(body.category) ? body.category : null,
    source: text(body.source), createdById: userId
  }).returning({ id: tests.id })
  return getTest(test!.id)
}

export async function updateTest(id: string, body: Body) {
  const test = await loadTest({ id })
  const db = useDb()
  const title = body.title !== undefined ? text(body.title) : test.title
  if (!title) throw bad('The test needs a title')
  const slug = body.slug !== undefined && text(body.slug) ? slugify(body.slug) : test.slug
  if (slug !== test.slug) {
    const [taken] = await db.select({ id: tests.id }).from(tests).where(and(eq(tests.slug, slug), ne(tests.id, id))).limit(1)
    if (taken) throw conflict('Another test already uses this address')
  }
  await db.update(tests).set({
    title, slug,
    description: body.description !== undefined ? text(body.description) : test.description,
    mode: MODES.includes(body.mode) ? body.mode : test.mode,
    access: body.access === 'PREMIUM' || body.access === 'FREE' ? body.access : test.access,
    category: body.category === null ? null : CATEGORIES.includes(body.category) ? body.category : test.category,
    source: body.source !== undefined ? text(body.source) : test.source
  }).where(eq(tests.id, id))
  if (body.mode && body.mode !== test.mode && test.status === 'PUBLISHED') {
    const check = readiness(await loadTest({ id }))
    if (check.errors.length) {
      await db.update(tests).set({ mode: test.mode }).where(eq(tests.id, id))
      throw createError({ statusCode: 400, message: 'The test does not fit this mode', data: { errors: check.errors } })
    }
  }
  return getTest(id)
}

export async function setStatus(id: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
  const test = await loadTest({ id })
  if (status === 'PUBLISHED') {
    const check = readiness(test)
    if (check.errors.length) throw createError({ statusCode: 400, message: 'The test is not ready yet', data: { errors: check.errors } })
  }
  const db = useDb()
  await db.update(tests).set({ status, ...(status === 'PUBLISHED' ? { publishedAt: test.publishedAt ?? new Date() } : {}) }).where(eq(tests.id, id))
  return getTest(id)
}

/** A test somebody sat is archived instead, so their results keep it. */
export async function deleteTest(id: string) {
  await loadTest({ id })
  const db = useDb()
  const [used] = await db.select({ n: count() }).from(attempts).where(eq(attempts.testId, id))
  if (used?.n) throw conflict('Candidates sat this test: archive it instead of deleting it')
  await db.delete(tests).where(eq(tests.id, id))
  return { deleted: true }
}

/** A copy to change freely: the same library items, in new sections, as a draft. */
export async function duplicateTest(id: string, userId: string) {
  const source = await loadTest({ id })
  const title = `${source.title} (copy)`.slice(0, 300)
  const db = useDb()
  const copyId = await db.transaction(async (tx) => {
    const [test] = await tx.insert(tests).values({
      slug: await uniqueSlug(title), title, description: source.description, mode: source.mode, access: source.access,
      category: source.category, module: source.module, source: source.source, createdById: userId
    }).returning({ id: tests.id })
    for (const section of source.sections) {
      const [created] = await tx.insert(sections).values({
        testId: test!.id, skill: section.skill, position: section.position, title: section.title, instructions: section.instructions,
        durationSeconds: section.durationSeconds, audioRef: section.audioRef, settings: section.settings
      }).returning({ id: sections.id })
      if (section.items.length) {
        await tx.insert(sectionItems).values(section.items.map((item: any) => ({
          sectionId: created!.id, position: item.position, partId: item.partId, writingTaskId: item.writingTaskId, speakingPartId: item.speakingPartId
        })))
      }
    }
    return test!.id
  })
  return getTest(copyId)
}

// ─── Sections ────────────────────────────────────────────────────────────────────────────

function checkSkill(skill: string): Skill {
  if (!isSkill(skill)) throw bad('Unknown section')
  return skill
}

async function upsertSection(testId: string, skill: Skill, values: Body = {}) {
  const db = useDb()
  const [existing] = await db.select().from(sections).where(and(eq(sections.testId, testId), eq(sections.skill, skill))).limit(1)
  if (existing) {
    if (Object.keys(values).length) await db.update(sections).set(values).where(eq(sections.id, existing.id))
    return existing.id
  }
  const [created] = await db.insert(sections).values({ testId, skill, position: SECTION_ORDER[skill], ...values }).returning({ id: sections.id })
  return created!.id
}

export async function saveSection(testId: string, skillName: string, body: Body) {
  const skill = checkSkill(skillName)
  await loadTest({ id: testId })
  await upsertSection(testId, skill, {
    title: body.title ?? null, instructions: body.instructions ?? null, durationSeconds: body.durationSeconds ?? null,
    audioRef: skill === 'LISTENING' ? body.audioRef ?? null : null, settings: body.settings ?? {}
  })
  return getTest(testId)
}

export async function removeSection(testId: string, skillName: string) {
  const skill = checkSkill(skillName)
  await loadTest({ id: testId })
  const db = useDb()
  const [section] = await db.select().from(sections).where(and(eq(sections.testId, testId), eq(sections.skill, skill))).limit(1)
  if (section) {
    const [used] = await db.select({ n: count() }).from(attempts).where(eq(attempts.sectionId, section.id))
    if (used?.n) throw conflict('Candidates sat this section: it cannot be removed')
    await db.delete(sections).where(eq(sections.id, section.id))
  }
  return getTest(testId)
}

/** Places a library item in a section, creating the section when it is the first. */
export async function addItem(testId: string, skillName: string, body: Body) {
  const skill = checkSkill(skillName)
  const given = [body.partId, body.writingTaskId, body.speakingPartId].filter(Boolean)
  if (given.length !== 1) throw bad('Choose one part, writing task or speaking part')
  await loadTest({ id: testId })
  if (body.partId) {
    const part = await partRow(body.partId)
    if (part.skill !== skill) throw bad(`This is not a ${skill.toLowerCase()} part`)
  }
  if (body.writingTaskId) {
    if (skill !== 'WRITING') throw bad('A writing task goes in the Writing section')
    await writingTaskRow(body.writingTaskId)
  }
  if (body.speakingPartId) {
    if (skill !== 'SPEAKING') throw bad('A speaking part goes in the Speaking section')
    await getSpeakingPart(body.speakingPartId)
  }
  const sectionId = await upsertSection(testId, skill)
  const db = useDb()
  const [duplicate] = await db.select({ id: sectionItems.id }).from(sectionItems).where(and(
    eq(sectionItems.sectionId, sectionId),
    body.partId ? eq(sectionItems.partId, body.partId) : body.writingTaskId ? eq(sectionItems.writingTaskId, body.writingTaskId) : eq(sectionItems.speakingPartId, body.speakingPartId)
  )).limit(1)
  if (duplicate) throw conflict('It is in this section already')
  const [last] = await db.select({ n: max(sectionItems.position) }).from(sectionItems).where(eq(sectionItems.sectionId, sectionId))
  await db.insert(sectionItems).values({
    sectionId, position: (last?.n ?? 0) + 1,
    partId: body.partId ?? null, writingTaskId: body.writingTaskId ?? null, speakingPartId: body.speakingPartId ?? null
  })
  return getTest(testId)
}

export async function removeItem(testId: string, itemId: string) {
  const db = useDb()
  const [item] = await db.select({ id: sectionItems.id }).from(sectionItems)
    .innerJoin(sections, eq(sections.id, sectionItems.sectionId))
    .where(and(eq(sectionItems.id, itemId), eq(sections.testId, testId))).limit(1)
  if (!item) throw notFound('Not found')
  await db.delete(sectionItems).where(eq(sectionItems.id, itemId))
  return getTest(testId)
}

export async function reorderItems(testId: string, skillName: string, ids: string[]) {
  const skill = checkSkill(skillName)
  const db = useDb()
  const [section] = await db.select().from(sections).where(and(eq(sections.testId, testId), eq(sections.skill, skill))).limit(1)
  if (!section) throw notFound('Section not found')
  const own = new Set((await db.select({ id: sectionItems.id }).from(sectionItems).where(eq(sectionItems.sectionId, section.id))).map(r => r.id))
  if (!Array.isArray(ids) || ids.length !== own.size || ids.some(id => !own.has(id))) throw bad('The list is incomplete')
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) await tx.update(sectionItems).set({ position: index + 1 }).where(eq(sectionItems.id, id))
  })
  return getTest(testId)
}
