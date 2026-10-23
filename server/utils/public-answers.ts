import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { aiReviews, attempts, essays, questionGroups, questionItems } from '../database/schema'

/**
 * The public answer pages, for search engines and anyone revising: each Listening and Reading part of
 * a published test with its answers, why each is right and the words it comes from (never the
 * recording, and only the opening of a passage); and each Writing task with samples its writers
 * chose to show, unnamed, with the AI's marks. Each has an address of its own, made from its title
 * and the start of its id; a part or task used in several tests has one page, sat in the first.
 */

type Skill = 'LISTENING' | 'READING'
const PAGE_SIZE = 40

/** An address for a part or task: its title, then the first 8 characters of its id. */
export const publicSlug = (title: string | null | undefined, id: string) => `${slugify(title || 'ielts')}-${id.slice(0, 8)}`
const idPrefixOf = (slug: string) => /-([0-9a-f]{8})$/.exec(slug)?.[1] ?? null

/** Text from HTML: tags out, entities read, spaces tidied. */
function plain(html: string | null | undefined) {
  return (html ?? '')
    .replace(/<\/(p|div|h\d|li|br)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '\'')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}
/** The opening of a text, cut at a word. */
function opening(text: string, max: number) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : max).trim()}…`
}

/** Listening or Reading parts of published tests, each once, with the first test it is in. */
async function publishedParts(skill: Skill, opts: { exam?: Exam, prefix?: string } = {}) {
  const rows = await useDb().execute(sql`
    select distinct on (p.id) p.id, p.title, p.exam, p.part_number as "partNumber", p.passage,
      t.slug as "testSlug", t.title as "testTitle", t.module, t.access,
      (select count(*)::int from ${questionGroups} g join ${questionItems} qi on qi.group_id = g.id where g.part_id = p.id) as questions
    from parts p
    join section_items si on si.part_id = p.id
    join sections s on s.id = si.section_id
    join tests t on t.id = s.test_id
    where t.status = 'PUBLISHED' and p.skill = ${skill}
      ${opts.exam ? sql`and p.exam = ${opts.exam}` : sql``}
      ${opts.prefix ? sql`and p.id::text like ${`${opts.prefix}%`}` : sql``}
    order by p.id, t.published_at asc nulls last`) as unknown as {
    id: string
    title: string | null
    exam: string
    partNumber: number
    passage: string | null
    testSlug: string
    testTitle: string
    module: string
    access: string
    questions: number
  }[]
  return [...rows]
}

type PartRow = Awaited<ReturnType<typeof publishedParts>>[number]
const partTitle = (r: PartRow) => r.title || `${r.testTitle} · Part ${r.partNumber}`
const card = (skill: Skill) => (r: PartRow) => ({
  slug: publicSlug(partTitle(r), r.id),
  title: partTitle(r),
  exam: r.exam,
  partNumber: r.partNumber,
  questions: r.questions,
  preview: skill === 'READING' ? opening(plain(r.passage), 180) : '',
  test: { slug: r.testSlug, title: r.testTitle }
})

/** Every Listening or Reading part with public answers, for an exam or both, by title. */
export async function answersHub(skill: Skill, query: Record<string, any>) {
  const exam = isExam(query.exam) ? query.exam : undefined
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const all = (await publishedParts(skill, { exam })).filter(r => r.questions > 0).map(card(skill))
    .sort((a, b) => a.title.localeCompare(b.title, 'en', { numeric: true }))
  return paged(all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), all.length, page, PAGE_SIZE)
}

/** What a key reads as: a letter with its option's words (C: "a rise in prices"), or the words themselves. */
function keyText(answer: string, content: any) {
  const pool = [...(content?.options ?? []), ...(content?.headings ?? []), ...(content?.endings ?? [])] as { key?: string, text?: string }[]
  const found = pool.find(o => o.key && o.key === answer)
  return found?.text ? `${answer}: ${plain(found.text)}` : answer
}

/** One part's public page: the passage's opening, every answer with its explanation and words, and others like it. */
export async function answersPage(skill: Skill, slug: string) {
  const prefix = idPrefixOf(slug)
  if (!prefix) throw createError({ statusCode: 404, message: 'Not found' })
  const [part] = await publishedParts(skill, { prefix })
  if (!part) throw createError({ statusCode: 404, message: 'Not found' })
  const db = useDb()
  const groups = await db.select().from(questionGroups).where(eq(questionGroups.partId, part.id)).orderBy(asc(questionGroups.position))
  const items = groups.length
    ? await db.select().from(questionItems).where(inArray(questionItems.groupId, groups.map(g => g.id))).orderBy(asc(questionItems.number))
    : []
  const answers = items.map((i) => {
    const g = groups.find(x => x.id === i.groupId)!
    const solo = items.filter(x => x.groupId === g.id).length === 1
    return {
      number: i.number,
      type: g.type,
      prompt: plain(i.prompt) || null,
      answers: i.acceptedAnswers.map(a => keyText(a, g.content)),
      // Explanations and the group's note are authored HTML, shown as on the review.
      explanation: i.explanation || (solo ? g.explanation : null) || null,
      evidence: i.evidence ? plain(i.evidence) : null
    }
  })
  // Others of the same skill and exam, for reading on.
  const others = (await publishedParts(skill, { exam: part.exam as Exam })).filter(r => r.id !== part.id && r.questions > 0)
  const related = nextBy(others, partTitle(part), partTitle).map(card(skill))
  const text = plain(part.passage)
  return {
    ...card(skill)(part),
    // The opening paragraphs only: the whole passage is for sitting it.
    passageOpening: skill === 'READING' ? opening(text.split('\n\n').slice(0, 2).join('\n\n'), 700) : null,
    practise: `/tests/${part.testSlug}/${skill.toLowerCase()}?part=${part.partNumber}`,
    premium: part.access === 'PREMIUM',
    groups: groups.map(g => ({ type: g.type, instruction: plain(g.instruction) || null, numbers: items.filter(i => i.groupId === g.id).map(i => i.number) })),
    answers,
    related
  }
}

/** The six that come after this title in the hub's order (going round), so each page links on to others. */
function nextBy<T>(rows: T[], title: string, titleOf: (r: T) => string) {
  const sorted = [...rows].sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'en', { numeric: true }))
  const at = sorted.findIndex(r => titleOf(r).localeCompare(title, 'en', { numeric: true }) > 0)
  return (at < 0 ? sorted : [...sorted.slice(at), ...sorted.slice(0, at)]).slice(0, 6)
}

// ---------- Writing ----------

/** Writing tasks of published tests, each once, with the first test it is in. */
async function publishedTasks(opts: { exam?: Exam, task?: number, prefix?: string } = {}) {
  const rows = await useDb().execute(sql`
    select distinct on (w.id) w.id, w.title, w.prompt, w.exam, w.task_number as "taskNumber", w.image_ref as "imageRef",
      w.min_words as "minWords", w.suggested_minutes as "suggestedMinutes", w.module as "taskModule",
      t.slug as "testSlug", t.title as "testTitle", t.module, t.access,
      (select count(*)::int from ${essays} e where e.task_id = w.id and e.shared_at is not null and e.hidden_at is null) as samples
    from writing_tasks w
    join section_items si on si.writing_task_id = w.id
    join sections s on s.id = si.section_id
    join tests t on t.id = s.test_id
    where t.status = 'PUBLISHED'
      ${opts.exam ? sql`and w.exam = ${opts.exam}` : sql``}
      ${opts.task ? sql`and w.task_number = ${opts.task}` : sql``}
      ${opts.prefix ? sql`and w.id::text like ${`${opts.prefix}%`}` : sql``}
    order by w.id, t.published_at asc nulls last`) as unknown as {
    id: string
    title: string | null
    prompt: string
    exam: string
    taskNumber: number
    imageRef: string | null
    minWords: number | null
    suggestedMinutes: number | null
    taskModule: string | null
    testSlug: string
    testTitle: string
    module: string
    access: string
    samples: number
  }[]
  return [...rows]
}

const taskTitle = (r: { title: string | null, prompt: string }) => r.title || opening(plain(r.prompt).split('\n')[0] ?? '', 70)
const taskCard = (r: Awaited<ReturnType<typeof publishedTasks>>[number]) => ({
  slug: publicSlug(taskTitle(r), r.id),
  title: taskTitle(r),
  exam: r.exam,
  taskNumber: r.taskNumber,
  preview: opening(plain(r.prompt), 200),
  samples: r.samples,
  test: { slug: r.testSlug, title: r.testTitle }
})

/** Every Writing task with a public page: an exam's, one task number's, those with samples first. */
export async function writingHub(query: Record<string, any>) {
  const exam = isExam(query.exam) ? query.exam : undefined
  const task = Number(query.task) || undefined
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const rows = await publishedTasks({ exam, task })
  // A shared essay counts once it is shown: marked, and good enough (samplesOf decides).
  await Promise.all(rows.filter(r => r.samples > 0).map(async (r) => {
    r.samples = (await samplesOf(r.id)).length
  }))
  const all = rows.map(taskCard)
    .sort((a, b) => (b.samples > 0 ? 1 : 0) - (a.samples > 0 ? 1 : 0) || a.title.localeCompare(b.title, 'en', { numeric: true }))
  return paged(all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), all.length, page, PAGE_SIZE)
}

/** A sample worth learning from: IELTS band 5 or more, Multilevel about B1 or more (2.5 of 5 on average). */
const worthShowing = (s: { scale: number, band: number | null, criteria: Record<string, number> }) => {
  if (s.scale === 9) return (s.band ?? 0) >= 5
  const marks = Object.values(s.criteria).map(Number).filter(n => !Number.isNaN(n))
  return marks.length > 0 && marks.reduce((a, b) => a + b, 0) / marks.length >= 2.5
}

/**
 * Samples of a task its writers chose to show, unnamed, each with the AI's marks for it (an essay
 * shows only once the AI has marked it, and only if it is good enough to learn from): the best
 * first, at most three.
 */
async function samplesOf(taskId: string) {
  const rows = await useDb().select({
    id: essays.id, text: essays.text, wordCount: essays.wordCount, feedback: essays.feedback, sharedAt: essays.sharedAt,
    exam: attempts.exam, result: aiReviews.result
  }).from(essays)
    .innerJoin(attempts, eq(attempts.id, essays.attemptId))
    .innerJoin(aiReviews, and(eq(aiReviews.attemptId, attempts.id), eq(aiReviews.status, 'DONE')))
    .where(and(eq(essays.taskId, taskId), isNotNull(essays.sharedAt), isNull(essays.hiddenAt)))
    .orderBy(sql`${essays.sharedAt} desc`).limit(30)
  return rows.map((r) => {
    const t = ((r.result as any)?.tasks ?? []).find((x: any) => x.taskId === taskId)
    if (!t || !r.text.trim()) return null
    const scale = (r.result as any)?.scale === 9 ? 9 : 5
    const criteria = (t.criteria ?? {}) as Record<string, number>
    const total = Object.values(criteria).reduce((s, v) => s + (Number(v) || 0), 0)
    return {
      id: r.id, text: r.text, wordCount: r.wordCount,
      scale, band: t.band ?? null, level: t.level ?? null, criteria, comment: t.comment ?? '',
      examinerFeedback: r.feedback || null,
      rank: t.band ?? total
    }
  }).filter((s): s is NonNullable<typeof s> => !!s && worthShowing(s))
    .sort((a, b) => b.rank - a.rank).slice(0, 3)
    .map(({ rank: _r, ...s }) => s)
}

/** A Writing task's public page: the task as set, the samples, and others of the same task. */
export async function writingPage(slug: string) {
  const prefix = idPrefixOf(slug)
  if (!prefix) throw createError({ statusCode: 404, message: 'Not found' })
  const [task] = await publishedTasks({ prefix })
  if (!task) throw createError({ statusCode: 404, message: 'Not found' })
  const [samples, others] = await Promise.all([
    samplesOf(task.id),
    publishedTasks({ exam: task.exam as Exam, task: task.taskNumber })
  ])
  const defaults = writingTaskDefaults(task.exam, task.taskNumber)
  return {
    ...taskCard(task),
    prompt: task.prompt,
    imageUrl: sign(task.imageRef),
    minWords: task.minWords ?? defaults.minWords,
    minutes: task.suggestedMinutes ?? defaults.minutes,
    practise: `/tests/${task.testSlug}/writing?part=${task.taskNumber}`,
    premium: task.access === 'PREMIUM',
    samples,
    related: nextBy(others.filter(o => o.id !== task.id), taskTitle(task), taskTitle).map(taskCard)
  }
}

/** Shows or stops showing one of the user's essays as a sample. */
export async function shareEssay(userId: string, attemptId: string, taskId: string, share: boolean) {
  const db = useDb()
  const [row] = await db.select({ id: essays.id, userId: attempts.userId, wordCount: essays.wordCount }).from(essays)
    .innerJoin(attempts, eq(attempts.id, essays.attemptId))
    .where(and(eq(essays.attemptId, attemptId), eq(essays.taskId, taskId))).limit(1)
  if (!row || row.userId !== userId) throw createError({ statusCode: 404, message: 'Essay not found' })
  if (share && row.wordCount < 50) throw createError({ statusCode: 400, message: 'Write at least 50 words to share it' })
  await db.update(essays).set({ sharedAt: share ? new Date() : null }).where(eq(essays.id, row.id))
  return { shared: share }
}

/** For the sitemap: every public answer and task page. */
export async function publicAnswerUrls() {
  const [listening, reading, writing] = await Promise.all([publishedParts('LISTENING'), publishedParts('READING'), publishedTasks()])
  return [
    ...listening.filter(r => r.questions > 0).map(r => `/listening/${card('LISTENING')(r).slug}`),
    ...reading.filter(r => r.questions > 0).map(r => `/reading/${card('READING')(r).slug}`),
    ...writing.map(r => `/writing/${taskCard(r).slug}`)
  ]
}
