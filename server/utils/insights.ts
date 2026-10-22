import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { aiReviews, attempts } from '../database/schema'
import { accessOf } from './billing'
import { unlockedTestIds } from './rewards'

/**
 * Where a user loses marks, from what they have already done: Listening and Reading by task type
 * and part (from their marked answers), Writing and Speaking by criterion and task (from their AI
 * reviews), and their score over time. Each weak spot comes with one part to practise next, from
 * a published test they can open and have not done yet when there is one.
 */

const RECENT_DAYS = 180
/** Fewer answers than this on a task type say too little to call it weak. */
const MIN_ANSWERS = 4
/** Below this share right, a task type counts as a weak spot. */
const WEAK_SHARE = 0.7

export interface Practise { slug: string, title: string, skill: string, part: number, done: boolean, locked: boolean }
/**
 * A weak spot. Pages word it from the numbers in their own language: a task type's share right over
 * `total` questions, or a criterion's average out of 5 and the task or part that was lowest.
 * `label` and `detail` are the English wording.
 */
export interface Focus {
  skill: string
  kind: 'TYPE' | 'CRITERION'
  key: string
  label: string
  detail: string
  practise: Practise | null
  share?: number
  total?: number
  average?: number
  taskNumber?: number | null
}

const WRITING_CRITERIA = { taskAchievement: 'Task achievement', organisation: 'Organisation', vocabulary: 'Vocabulary', grammar: 'Grammar' } as Record<string, string>
const SPEAKING_CRITERIA = { fluency: 'Fluency', vocabulary: 'Vocabulary', grammar: 'Grammar', pronunciation: 'Pronunciation', taskAchievement: 'Task achievement' } as Record<string, string>
/** Tests of an exam, in SQL over `tests t`. */
const examTests = (exam: Exam) => (exam === 'IELTS' ? sql`t.module in ('ACADEMIC', 'GENERAL_TRAINING')` : sql`t.module = 'MULTILEVEL'`)
const TYPE_LABEL: Record<string, string> = {
  TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given', YES_NO_NOT_GIVEN: 'Yes / No / Not Given', MULTIPLE_CHOICE: 'Multiple choice',
  MULTIPLE_ANSWER: 'Multiple answer', NOTE_COMPLETION: 'Note completion', SENTENCE_COMPLETION: 'Sentence completion',
  SUMMARY_COMPLETION: 'Summary completion', SUMMARY_COMPLETION_DRAG_DROP: 'Summary completion (word list)', SHORT_ANSWER: 'Short answer',
  TABLE_COMPLETION: 'Table completion', FLOW_CHART_COMPLETION: 'Flow chart completion', DIAGRAM_LABELLING: 'Diagram labelling',
  MATCHING_HEADINGS: 'Matching headings', MATCHING_INFORMATION: 'Matching information', MATCHING_FEATURES: 'Matching features',
  MATCHING_SENTENCE_ENDINGS: 'Matching sentence endings', PLAN_MAP_LABELLING: 'Plan / map labelling'
}
const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ')
const pct = (right: number, total: number) => (total ? Math.round((right / total) * 100) : 0)

type Rows<T> = T[]

/** Right answers by task type and by part, over the user's recent Listening and Reading. */
async function objectiveStats(userId: string, exam: Exam) {
  const db = useDb()
  const since = new Date(Date.now() - RECENT_DAYS * 864e5).toISOString()
  const [byType, byPart] = await Promise.all([
    db.execute(sql`
      select a.skill, g.type, count(*)::int as total, count(*) filter (where ans.is_correct)::int as right
      from answers ans
      join attempts a on a.id = ans.attempt_id
      join question_items qi on qi.id = ans.item_id
      join question_groups g on g.id = qi.group_id
      where a.user_id = ${userId} and a.exam = ${exam} and a.submitted_at > ${since}::timestamptz and a.skill in ('LISTENING', 'READING')
      group by a.skill, g.type`) as unknown as Promise<Rows<{ skill: string, type: string, total: number, right: number }>>,
    db.execute(sql`
      select a.skill, p.part_number as part, count(*)::int as total, count(*) filter (where ans.is_correct)::int as right
      from answers ans
      join attempts a on a.id = ans.attempt_id
      join question_items qi on qi.id = ans.item_id
      join question_groups g on g.id = qi.group_id
      join parts p on p.id = g.part_id
      where a.user_id = ${userId} and a.exam = ${exam} and a.submitted_at > ${since}::timestamptz and a.skill in ('LISTENING', 'READING')
      group by a.skill, p.part_number`) as unknown as Promise<Rows<{ skill: string, part: number, total: number, right: number }>>
  ])
  return { byType: [...byType], byPart: [...byPart] }
}

interface Reviewed { criteria: Record<string, number>, taskNumber?: number, partNumber?: number }

/**
 * Average criteria and task marks from the user's recent AI reviews of one skill, for one exam
 * (IELTS reviews mark out of 9 and say so; Multilevel ones mark out of 5).
 */
async function criteriaStats(userId: string, skill: 'WRITING' | 'SPEAKING', exam: Exam) {
  const all = await useDb().select({ result: aiReviews.result }).from(aiReviews)
    .where(and(eq(aiReviews.userId, userId), eq(aiReviews.skill, skill), eq(aiReviews.status, 'DONE')))
    .orderBy(desc(aiReviews.createdAt)).limit(30)
  const rows = all.filter(r => ((r.result as { scale?: number } | null)?.scale === 9) === (exam === 'IELTS')).slice(0, 10)
  const names = skill === 'WRITING' ? WRITING_CRITERIA : SPEAKING_CRITERIA
  const sums: Record<string, { sum: number, n: number }> = {}
  const tasks: Record<number, { sum: number, n: number }> = {}
  for (const r of rows) {
    const res = r.result as { tasks?: Reviewed[], parts?: Reviewed[] } | null
    for (const t of (skill === 'WRITING' ? res?.tasks : res?.parts) ?? []) {
      // A criterion a review did not mark (pronunciation, before it was assessed) is left out, not counted as 0.
      const keys = Object.keys(names).filter(k => t.criteria?.[k] != null)
      const marks = keys.map(k => Number(t.criteria[k]))
      if (marks.every(m => !m)) continue // nothing written or said
      keys.forEach((k, i) => {
        sums[k] = { sum: (sums[k]?.sum ?? 0) + marks[i]!, n: (sums[k]?.n ?? 0) + 1 }
      })
      const no = Number(skill === 'WRITING' ? t.taskNumber : t.partNumber)
      if (no) tasks[no] = { sum: (tasks[no]?.sum ?? 0) + marks.reduce((a, b) => a + b, 0) / marks.length, n: (tasks[no]?.n ?? 0) + 1 }
    }
  }
  const latest = rows[0]?.result as { priorities?: string[] } | undefined
  return {
    reviews: rows.length,
    scale: exam === 'IELTS' ? 9 : 5,
    criteria: Object.entries(names).map(([key, label]) => ({ key, label, average: sums[key] ? Math.round((sums[key].sum / sums[key].n) * 10) / 10 : null })),
    tasks: Object.entries(tasks).map(([no, t]) => ({ number: Number(no), label: skill === 'WRITING' ? taskName(exam, Number(no)) : speakingPartName(exam, Number(no)), average: Math.round((t.sum / t.n) * 10) / 10, reviews: t.n }))
      .sort((a, b) => a.number - b.number),
    priorities: (latest?.priorities ?? []).slice(0, 3)
  }
}

/** The user's scores (IELTS: bands) for whole sections over time, oldest first (the last 10). */
async function scoreTrend(userId: string, exam: Exam) {
  const value = exam === 'IELTS' ? attempts.band : attempts.score
  const rows = await useDb().select({ skill: attempts.skill, score: value, at: attempts.submittedAt }).from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.exam, exam), isNotNull(value), isNull(attempts.partNumber)))
    .orderBy(desc(attempts.submittedAt)).limit(80)
  const by: Record<string, { score: number, at: Date }[]> = {}
  for (const r of rows) {
    const list = (by[r.skill] ??= [])
    if (list.length < 10) list.push({ score: Number(r.score), at: r.at })
  }
  return Object.fromEntries(Object.entries(by).map(([skill, list]) => [skill, list.reverse()]))
}

interface Pick { userId: string, premium: boolean, unlocked: Set<string>, exam: Exam }

/**
 * One part to practise: from a published test, with the task type (Listening/Reading) or the task
 * or part number (Writing/Speaking) asked for. Ones the user can open and has not done come first.
 */
async function practiseFor(pick: Pick, skill: string, match: { type: string } | { part: number }): Promise<Practise | null> {
  const join = 'type' in match
    ? sql`join parts p on p.id = si.part_id join question_groups g on g.part_id = p.id and g.type = ${match.type}`
    : skill === 'WRITING'
      ? sql`join writing_tasks p on p.id = si.writing_task_id and p.task_number = ${match.part}`
      : skill === 'SPEAKING'
        ? sql`join speaking_parts p on p.id = si.speaking_part_id and p.part_number = ${match.part}`
        : sql`join parts p on p.id = si.part_id and p.part_number = ${match.part}`
  const number = skill === 'WRITING' ? sql`p.task_number` : sql`p.part_number`
  const rows = await useDb().execute(sql`
    select distinct on (t.id, ${number}) t.id, t.slug, t.title, t.access, ${number} as part,
      exists (select 1 from attempts a where a.user_id = ${pick.userId} and a.test_id = t.id and a.skill = s.skill
        and (a.part_number is null or a.part_number = ${number})) as done
    from section_items si
    join sections s on s.id = si.section_id and s.skill = ${skill}
    join tests t on t.id = s.test_id and t.status = 'PUBLISHED' and ${examTests(pick.exam)}
    ${join}
    limit 200`) as unknown as Rows<{ id: string, slug: string, title: string, access: string, part: number, done: boolean }>
  const options = [...rows].map(r => ({ ...r, locked: r.access === 'PREMIUM' && !pick.premium && !pick.unlocked.has(r.id) }))
  if (!options.length) return null
  const rank = (o: typeof options[number]) => (o.locked ? 2 : 0) + (o.done ? 1 : 0)
  const best = Math.min(...options.map(rank))
  const pool = options.filter(o => rank(o) === best)
  const o = pool[Math.floor(Math.random() * pool.length)]!
  return { slug: o.slug, title: o.title, skill, part: Number(o.part), done: o.done, locked: o.locked }
}

/** Insights for one exam: an IELTS candidate's on bands, a Multilevel one's on scores out of 75. */
export async function insightsOf(user: { id: string, role: string }, exam: Exam = 'MULTILEVEL') {
  const [objective, writing, speaking, trend, access, unlocked] = await Promise.all([
    objectiveStats(user.id, exam), criteriaStats(user.id, 'WRITING', exam), criteriaStats(user.id, 'SPEAKING', exam), scoreTrend(user.id, exam),
    accessOf(user), unlockedTestIds(user.id)
  ])
  const pick: Pick = { userId: user.id, premium: access.premium, unlocked: new Set(unlocked), exam }
  const outOf = exam === 'IELTS' ? 9 : 5

  const skills = (['LISTENING', 'READING'] as const).map((skill) => {
    const types = objective.byType.filter(r => r.skill === skill)
    const total = types.reduce((a, r) => a + r.total, 0)
    const right = types.reduce((a, r) => a + r.right, 0)
    return {
      skill,
      answers: total,
      share: pct(right, total),
      types: types.map(r => ({ type: r.type, label: typeLabel(r.type), total: r.total, share: pct(r.right, r.total) }))
        .sort((a, b) => a.share - b.share || b.total - a.total),
      parts: objective.byPart.filter(r => r.skill === skill).map(r => ({ part: r.part, total: r.total, share: pct(r.right, r.total) }))
        .sort((a, b) => a.part - b.part)
    }
  })

  // The weak spots worth practising, weakest first: up to two task types per skill, and the lowest
  // criterion of Writing and Speaking with the task or part that held it back.
  type Spot = Omit<Focus, 'practise'> & { rank: number, part?: number }
  const spots: Spot[] = []
  for (const s of skills) {
    for (const t of s.types.filter(t => t.total >= MIN_ANSWERS && t.share / 100 < WEAK_SHARE).slice(0, 2)) {
      spots.push({ skill: s.skill, kind: 'TYPE', key: t.type, label: t.label, detail: `${t.share}% right over ${t.total} questions`, rank: t.share / 100, share: t.share, total: t.total })
    }
  }
  for (const [skill, stats] of [['WRITING', writing], ['SPEAKING', speaking]] as const) {
    const scored = stats.criteria.filter(c => c.average != null) as { key: string, label: string, average: number }[]
    if (!scored.length) continue
    const low = scored.reduce((a, b) => (b.average < a.average ? b : a))
    if (low.average >= (exam === 'IELTS' ? 7 : 4)) continue
    const task = stats.tasks.length ? stats.tasks.reduce((a, b) => (b.average < a.average ? b : a)) : null
    spots.push({
      skill, kind: 'CRITERION', key: low.key, label: low.label, rank: low.average / outOf, average: low.average, taskNumber: task?.number ?? null,
      detail: `${low.average}/${outOf} on average${task ? `; ${task.label} was your lowest` : ''}`,
      // Without a task to point at, the longest one: Task 2, or Part 3.
      part: task?.number ?? (skill === 'WRITING' ? (exam === 'IELTS' ? 2 : 3) : (exam === 'IELTS' ? 3 : 4))
    })
  }
  const top = spots.sort((a, b) => a.rank - b.rank).slice(0, 4)
  const practise = await Promise.all(top.map(f => practiseFor(pick, f.skill, f.kind === 'TYPE' ? { type: f.key } : { part: f.part! })))
  const focus: Focus[] = top.map(({ rank: _rank, part: _part, ...f }, i) => ({ ...f, practise: practise[i] ?? null }))

  return {
    exam,
    skills,
    writing,
    speaking,
    trend,
    focus
  }
}
