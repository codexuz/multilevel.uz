import { and, asc, eq } from 'drizzle-orm'
import { sections as sectionsTable, tests as testsTable } from '../database/schema'
import { openMockOfTest } from './live'

/**
 * Tests as the app reads them, in the same shapes as the erp-lms IELTS addon
 * (apps/api/src/addons/ielts/ielts-common.ts, ielts-content.service.ts): a test, its sections,
 * the parts, writing tasks and speaking parts placed in them, and each part's question groups.
 * Before a candidate hands in, answer keys, explanations and transcripts are left out.
 */

export const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const
export type Skill = (typeof SKILLS)[number]
export const isSkill = (value: unknown): value is Skill => SKILLS.includes(value as Skill)
export const SECTION_ORDER: Record<Skill, number> = { LISTENING: 1, READING: 2, WRITING: 3, SPEAKING: 4 }

/** The exam a test is for, from its module (MULTILEVEL, or ACADEMIC / GENERAL_TRAINING for IELTS). */
export const examOfTest = (test: { module?: string | null } | null | undefined): Exam => examOfModule(test?.module)

/** The exam a section's contents are written for (each part, task and speaking part says), Multilevel by default. */
export function examOfSection(section: any): Exam {
  const item = (section?.items ?? []).find((i: any) => i.part || i.writingTask || i.speakingPart)
  const exam = item?.part?.exam ?? item?.writingTask?.exam ?? item?.speakingPart?.exam
  return isExam(exam) ? exam : 'MULTILEVEL'
}

/** The official time of a section, used when it sets none. */
export const officialSeconds = (exam: string | null | undefined, skill: string) => formatOf(exam).seconds[skill as Skill] ?? 60 * 60

/**
 * The fewest words a writing task asks for: its own, else the exam's (Multilevel Task 1.1 50,
 * Task 1.2 120, Task 2 180; IELTS Task 1 150, Task 2 250).
 */
export const minimumWordsFor = (task: { taskNumber: number, minWords?: number | null, exam?: string | null }) =>
  task.minWords ?? writingTaskDefaults(task.exam, task.taskNumber).minWords

const words = (text: string) => String(text ?? '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean)
export const countEssayWords = (text: string) => words(text).length

/** Media are stored as public addresses (S3) or given as URLs in an imported file: shown as they are. */
export const sign = (ref?: string | null) => ref || null

const ITEMS_ORDER = { orderBy: (t: any, { asc: a }: any) => [a(t.position), a(t.number)] }

/** A section's items with everything placed in them, in order. */
export const SECTION_WITH = {
  items: {
    orderBy: (t: any, { asc: a }: any) => [a(t.position)],
    with: {
      part: { with: { groups: { orderBy: (t: any, { asc: a }: any) => [a(t.position)], with: { items: ITEMS_ORDER } } } },
      writingTask: true,
      speakingPart: { with: { questions: { orderBy: (t: any, { asc: a }: any) => [a(t.position)] } } }
    }
  }
} as const

export const TEST_WITH = {
  sections: { orderBy: (t: any, { asc: a }: any) => [a(t.position)], with: SECTION_WITH }
} as const

export type LoadedTest = NonNullable<Awaited<ReturnType<typeof findTest>>>

function findTest(where: { id?: string, slug?: string }) {
  const db = useDb()
  return db.query.tests.findFirst({
    where: where.id ? eq(testsTable.id, where.id) : eq(testsTable.slug, where.slug!),
    with: TEST_WITH as any
  }) as Promise<any>
}

/** A test with everything in it, or a 404. Drafts only for staff, or for everyone while a live mock of it is open. */
export async function loadTest(where: { id?: string, slug?: string }, opts: { publishedOnly?: boolean } = {}) {
  const test = await findTest(where)
  if (!test) throw createError({ statusCode: 404, message: 'Test not found' })
  if (opts.publishedOnly && test.status !== 'PUBLISHED' && !(await openMockOfTest(test.id))) throw createError({ statusCode: 404, message: 'Test not found' })
  return test
}

export async function loadSection(testId: string, skill: Skill) {
  const db = useDb()
  return db.query.sections.findFirst({
    where: and(eq(sectionsTable.testId, testId), eq(sectionsTable.skill, skill)),
    with: SECTION_WITH as any,
    orderBy: [asc(sectionsTable.position)]
  }) as Promise<any>
}

/** A question group. Before the candidate has handed in, the answers, explanations and pointers into the passage are left out. */
export function groupView(group: any, withKeys: boolean) {
  const { partId: _p, createdAt: _c, updatedAt: _u, ...g } = group
  const content = { ...(g.content ?? {}) }
  if (typeof content.image === 'string') content.imageUrl = sign(content.image)
  g.content = content
  const numbers = (g.items ?? []).map((item: any) => item.number)
  g.from = numbers.length ? Math.min(...numbers) : null
  g.to = numbers.length ? Math.max(...numbers) : null
  g.items = (g.items ?? []).map(({ groupId: _g, createdAt: _ic, updatedAt: _iu, ...item }: any) => item)
  if (!withKeys) {
    delete g.explanation
    g.items = g.items.map(({ acceptedAnswers: _a, explanation: _e, evidence: _ev, ...rest }: any) => rest)
  }
  return g
}

/** A Listening or Reading part with its questions and playable media. */
export function partView(part: any, withKeys: boolean) {
  const { groups, ...p } = part
  p.audioUrl = sign(part.audioRef)
  p.transcriptUrl = sign(part.transcriptRef)
  if (!withKeys) {
    // The transcript gives the Listening answers away until the attempt is in.
    delete p.transcriptUrl
    delete p.transcriptRef
  }
  if (Array.isArray(groups)) {
    p.groups = groups.map((group: any) => groupView(group, withKeys))
    const numbers = p.groups.flatMap((group: any) => (group.items ?? []).map((item: any) => item.number))
    p.questionCount = numbers.length
    p.from = numbers.length ? Math.min(...numbers) : null
    p.to = numbers.length ? Math.max(...numbers) : null
  }
  return p
}

export const writingTaskView = (task: any) => ({ ...task, imageUrl: sign(task.imageRef) })
export const speakingPartView = (part: any) => ({ ...part, imageUrl: sign(part.imageRef) })

export function sectionView(section: any, withKeys: boolean) {
  const { items, ...rest } = section
  return {
    ...rest,
    audioUrl: sign(section.audioRef),
    durationSeconds: section.durationSeconds ?? null,
    officialSeconds: officialSeconds(examOfSection(section), section.skill),
    items: (items ?? []).map((item: any) => ({
      id: item.id,
      position: item.position,
      part: item.part ? partView(item.part, withKeys) : null,
      writingTask: item.writingTask ? writingTaskView(item.writingTask) : null,
      speakingPart: item.speakingPart ? speakingPartView(item.speakingPart) : null
    }))
  }
}

export function testView(test: any, withKeys: boolean) {
  const { sections, ...rest } = test
  return { ...rest, exam: examOfTest(test), sections: (sections ?? []).map((section: any) => sectionView(section, withKeys)) }
}

/** What a list shows of a test: its sections and how long each takes. */
export function testSummary(test: any) {
  const { sections, ...rest } = test
  return {
    ...rest,
    exam: examOfTest(test),
    sections: (sections ?? []).map((s: any) => ({
      skill: s.skill,
      items: s.items?.length ?? 0,
      questions: (s.items ?? []).reduce((sum: number, item: any) => sum + (item.part?.groups ?? []).reduce((n: number, g: any) => n + (g.items?.length ?? 0), 0), 0),
      durationSeconds: s.durationSeconds ?? officialSeconds(examOfTest(test), s.skill)
    }))
  }
}

/** One section as the candidate sees it while sitting it: no answers, no transcripts. */
export function paperSection(section: any, withKeys = false) {
  const items = section.items ?? []
  const exam = examOfSection(section)
  return {
    skill: section.skill as Skill,
    exam,
    title: section.title ?? null,
    instructions: section.instructions ?? null,
    seconds: section.durationSeconds ?? officialSeconds(exam, section.skill),
    audioUrl: sign(section.audioRef),
    parts: items.filter((i: any) => i.part).map((i: any) => partView(i.part, withKeys)),
    tasks: items.filter((i: any) => i.writingTask).map((i: any) => ({ ...writingTaskView(i.writingTask), minWords: minimumWordsFor(i.writingTask) })),
    speaking: items.filter((i: any) => i.speakingPart).map((i: any) => speakingPartView(i.speakingPart))
  }
}

export interface Readiness { errors: string[], warnings: string[] }

const skillLabel = (skill: string) => skill[0] + skill.slice(1).toLowerCase()

/**
 * What stands between a test and its candidates. Errors stop it being published; warnings are
 * departures from its exam's format a practice test may make on purpose. A mock must follow it.
 */
export function readiness(test: any): Readiness {
  const errors: string[] = []
  const warnings: string[] = []
  const strict = test.mode === 'MOCK'
  const exam = examOfTest(test)
  const FORMAT = formatOf(exam)
  const examName = exam === 'IELTS' ? 'IELTS' : 'Multilevel'
  const flag = (message: string) => (strict ? errors : warnings).push(message)
  if (!test.title?.trim()) errors.push('The test has no title')
  if (!test.sections?.length) errors.push('The test has no sections')
  for (const section of test.sections ?? []) {
    const label = skillLabel(section.skill)
    if (!section.items?.length) {
      errors.push(`${label}: the section is empty`)
      continue
    }
    if (section.skill === 'LISTENING' || section.skill === 'READING') {
      const format = FORMAT[section.skill as 'LISTENING' | 'READING']
      const parts = section.items.map((item: any) => item.part).filter(Boolean)
      if (parts.length !== format.parts) flag(`${label}: ${examName} has ${format.parts} parts, this has ${parts.length}`)
      const numbers: number[] = []
      for (const part of parts) {
        if (!part.groups?.length) errors.push(`${label}, part ${part.partNumber}: no questions`)
        if (section.skill === 'READING' && !part.passage?.trim()) errors.push(`${label}, part ${part.partNumber}: no passage`)
        if (section.skill === 'LISTENING' && !part.audioRef && !section.audioRef) errors.push(`${label}, part ${part.partNumber}: no recording`)
        for (const group of part.groups ?? []) {
          for (const item of group.items ?? []) {
            numbers.push(item.number)
            if (!alternativesOf(item.acceptedAnswers).length) errors.push(`${label}: question ${item.number} has no answer`)
          }
        }
      }
      const doubled = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))]
      if (doubled.length) errors.push(`${label}: questions ${doubled.join(', ')} appear twice`)
      if (numbers.length !== format.questions) flag(`${label}: ${examName} has ${format.questions} questions, this has ${numbers.length}`)
    }
    if (section.skill === 'WRITING') {
      const tasks = section.items.map((item: any) => item.writingTask?.taskNumber).filter(Boolean)
      if (!FORMAT.WRITING.tasks.every(n => tasks.includes(n))) flag(`Writing: ${examName} has ${FORMAT.WRITING.tasks.map(n => taskName(exam, n)).join(', ')}`)
    }
    if (section.skill === 'SPEAKING') {
      const parts = section.items.map((item: any) => item.speakingPart?.partNumber).filter(Boolean)
      if (!FORMAT.SPEAKING.parts.every(n => parts.includes(n))) flag(`Speaking: ${examName} has ${FORMAT.SPEAKING.parts.map(n => speakingPartName(exam, n)).join(', ')}`)
    }
    // Everything in a test is written for its exam: the numbering and the scoring follow it.
    const strays = section.items.filter((item: any) => {
      const own = item.part?.exam ?? item.writingTask?.exam ?? item.speakingPart?.exam
      return own && own !== exam
    })
    if (strays.length) errors.push(`${label}: ${strays.length} ${strays.length === 1 ? 'item is' : 'items are'} written for another exam`)
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

// ─── Practising one part ─────────────────────────────────────────────────────────────────

/** A section item's number as candidates know it: Listening or Reading part, Writing task, Speaking part. */
export const itemNumber = (item: any): number | null => item.part?.partNumber ?? item.writingTask?.taskNumber ?? item.speakingPart?.partNumber ?? null

/** The section with only part `n` in it, to sit and mark on its own; null when it has no such part. */
export function pickPart(section: any, n: number) {
  const item = (section.items ?? []).find((i: any) => itemNumber(i) === n)
  return item ? { ...section, items: [item] } : null
}

/**
 * How long one part gets: its own time if the author set one; for Listening and Reading its share
 * of the section's time by questions (at least five minutes); for a Writing task the usual minutes.
 */
export function partSeconds(section: any) {
  const item = section.items?.[0]
  if (item?.part?.timeLimitMinutes) return item.part.timeLimitMinutes * 60
  if (item?.writingTask) return (item.writingTask.suggestedMinutes ?? writingTaskDefaults(item.writingTask.exam, item.writingTask.taskNumber).minutes) * 60
  const exam = examOfSection(section)
  if (item?.part) {
    const questions = (item.part.groups ?? []).reduce((n: number, g: any) => n + (g.items?.length ?? 0), 0)
    const format = formatOf(exam)[section.skill as 'LISTENING' | 'READING']
    const whole = section.durationSeconds ?? officialSeconds(exam, section.skill)
    return Math.max(300, Math.round((whole * questions) / (format?.questions ?? 35) / 60) * 60)
  }
  return section.durationSeconds ?? officialSeconds(exam, section.skill)
}

/** One part's paper: the part alone, its own recording rather than the whole section's, its time. */
export function paperPart(section: any) {
  const paper = paperSection(section)
  const own = paper.parts[0]?.audioUrl
  return { ...paper, seconds: partSeconds(section), audioUrl: own ? null : paper.audioUrl }
}
