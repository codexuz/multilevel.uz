import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { aiReviews, attempts, sections, tests, users } from '../database/schema'
import { type Focus, insightsOf } from './insights'

/**
 * The user's exam plan: days left to their exam, where each skill stands against their target, and
 * this week's goals (a whole section of each skill still below target, and the weakest spots to
 * practise), ticked off by what they actually do. Weeks run Monday to Sunday, Tashkent time.
 */

export const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const
const TARGET_OF_LEVEL: Record<string, number> = { B1: 38, B2: 51, C1: 65 }
const TZ_OFFSET_MS = 5 * 3600e3

/** Today's date in Tashkent, YYYY-MM-DD. */
export const tashkentToday = (now = Date.now()) => new Date(now + TZ_OFFSET_MS).toISOString().slice(0, 10)
const dayNumber = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 864e5)
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from)
/** Monday of this week in Tashkent, as the instant it began. */
function weekStart(today: string) {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  return new Date(Date.parse(`${today}T00:00:00Z`) - weekday * 864e5 - TZ_OFFSET_MS)
}

export const targetScoreOf = (u: { targetScore: number | null, targetLevel: string | null }) =>
  u.targetScore ?? TARGET_OF_LEVEL[u.targetLevel ?? ''] ?? TARGET_OF_LEVEL.B2!

/** Practice days a week to aim for: more as the exam gets closer. */
export const daysPerWeek = (daysLeft: number | null) => (daysLeft == null || daysLeft > 60 ? 3 : daysLeft > 30 ? 4 : daysLeft > 14 ? 5 : 6)

/**
 * A goal of the week: a whole section (`score` now and the `target`), or a weak spot to practise
 * (`focus`, as insights give it). Pages word it in their language; `label` and `detail` are English.
 */
export interface Goal {
  key: string
  kind: 'SECTION' | 'TYPE' | 'CRITERION'
  skill: string
  label: string
  detail: string
  done: boolean
  to: string
  score?: number | null
  target?: number
  focus?: Pick<Focus, 'key' | 'share' | 'total' | 'average' | 'taskNumber'>
}

const skillWord = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** An IELTS target from a CEFR level, when no band was chosen. */
const BAND_OF_LEVEL: Record<string, number> = { B1: 5, B2: 6.5, C1: 7.5 }
export const targetBandOf = (u: { targetBand: number | null, targetLevel: string | null }) =>
  u.targetBand ?? BAND_OF_LEVEL[u.targetLevel ?? ''] ?? 6.5

/**
 * Each skill's level now: the average of the last three whole sections (or AI estimates for Writing
 * and Speaking), as scores out of 75 or, for IELTS, bands.
 */
async function estimates(userId: string, exam: Exam) {
  const db = useDb()
  const ielts = exam === 'IELTS'
  const markedValue = ielts ? attempts.band : attempts.score
  const reviewValue = ielts ? aiReviews.band : aiReviews.score
  const [marked, reviews] = await Promise.all([
    db.select({ skill: attempts.skill, score: markedValue }).from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.exam, exam), isNotNull(markedValue), isNull(attempts.partNumber)))
      .orderBy(desc(attempts.submittedAt)).limit(60),
    db.select({ skill: aiReviews.skill, score: reviewValue }).from(aiReviews)
      .where(and(eq(aiReviews.userId, userId), eq(aiReviews.status, 'DONE'), isNotNull(reviewValue)))
      .orderBy(desc(aiReviews.createdAt)).limit(20)
  ])
  return Object.fromEntries(SKILLS.map((skill) => {
    let list = marked.filter(r => r.skill === skill).slice(0, 3)
    let source: 'MARKED' | 'AI' = 'MARKED'
    if (!list.length) {
      list = reviews.filter(r => r.skill === skill).slice(0, 3)
      source = 'AI'
    }
    const mean = list.length ? list.reduce((a, r) => a + Number(r.score), 0) / list.length : null
    const score = mean == null ? null : ielts ? roundToHalfBand(mean) : Math.round(mean)
    return [skill, { score, source: score == null ? null : source }]
  })) as Record<typeof SKILLS[number], { score: number | null, source: 'MARKED' | 'AI' | null }>
}

export async function planOf(user: { id: string, role: string }, now = Date.now()) {
  const db = useDb()
  const [u] = await db.select({ examDate: users.examDate, targetLevel: users.targetLevel, targetScore: users.targetScore, targetBand: users.targetBand, exam: users.exam })
    .from(users).where(eq(users.id, user.id)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'User not found' })
  const exam: Exam = isExam(u.exam) ? u.exam : 'IELTS'
  const ielts = exam === 'IELTS'
  const today = tashkentToday(now)
  const since = weekStart(today)
  const daysLeft = u.examDate ? daysBetween(today, u.examDate) : null
  const target = ielts ? targetBandOf(u) : targetScoreOf(u)
  const ofExam = ielts ? inArray(tests.module, [...IELTS_MODULES]) : eq(tests.module, 'MULTILEVEL')

  const [level, insights, week, weekReviews, offered] = await Promise.all([
    estimates(user.id, exam),
    insightsOf(user, exam),
    db.select({ skill: attempts.skill, partNumber: attempts.partNumber, at: attempts.submittedAt }).from(attempts)
      .where(and(eq(attempts.userId, user.id), eq(attempts.exam, exam), gte(attempts.submittedAt, since))),
    db.select({ skill: aiReviews.skill }).from(aiReviews)
      .where(and(eq(aiReviews.userId, user.id), gte(aiReviews.createdAt, since), sql`${aiReviews.status} <> 'FAILED'`)),
    db.selectDistinct({ skill: sections.skill }).from(sections).innerJoin(tests, eq(tests.id, sections.testId)).where(and(eq(tests.status, 'PUBLISHED'), ofExam))
  ])

  // A whole section of each skill below target (all four in the last month), the furthest behind first.
  const gap = (s: typeof SKILLS[number]) => target - (level[s].score ?? -1)
  // Only skills the library has a section of.
  const behind = SKILLS.filter(s => offered.some(o => o.skill === s)).sort((a, b) => gap(b) - gap(a))
  const toSit = daysLeft != null && daysLeft <= 30
    ? behind
    : behind.filter(s => gap(s) > 0).concat(behind.filter(s => gap(s) <= 0)).slice(0, Math.max(2, behind.filter(s => gap(s) > 0).length))
  const goals: Goal[] = toSit.map(s => ({
    key: `section-${s}`, kind: 'SECTION', skill: s, score: level[s].score, target,
    label: `A whole ${skillWord(s)} section`,
    detail: level[s].score == null ? 'No score yet: see where you stand' : ielts ? `Now about band ${level[s].score}, aiming for ${target}` : `Now about ${level[s].score}/75, aiming for ${target}`,
    done: week.some(a => a.skill === s && a.partNumber == null),
    to: `/tests?exam=${exam}&skill=${s}`
  }))
  for (const f of insights.focus.slice(0, 2)) {
    if (!f.practise) continue
    const p = f.practise
    goals.push({
      key: `focus-${f.skill}-${f.key}`, kind: f.kind, skill: f.skill,
      focus: { key: f.key, share: f.share, total: f.total, average: f.average, taskNumber: f.taskNumber },
      label: `Practise ${skillWord(f.skill)}: ${f.label}`,
      detail: f.detail,
      done: week.some(a => a.skill === p.skill && a.partNumber === p.part)
        || (f.kind === 'CRITERION' && weekReviews.some(r => r.skill === f.skill)),
      to: `/tests/${p.slug}/${p.skill.toLowerCase()}?part=${p.part}`
    })
  }
  const practisedDays = new Set(week.map(a => tashkentToday(a.at.getTime()))).size

  return {
    exam,
    targetBand: ielts ? target : null,
    examDate: u.examDate,
    daysLeft,
    targetLevel: u.targetLevel,
    targetScore: target,
    level,
    week: { from: tashkentToday(since.getTime()), practisedDays, aimDays: daysPerWeek(daysLeft) },
    goals: goals.sort((a, b) => Number(a.done) - Number(b.done))
  }
}
