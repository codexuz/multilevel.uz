/**
 * Marking a submitted Listening or Reading section against its keys, as the erp-lms IELTS addon
 * does (ielts-attempts.service.ts finish): "choose TWO" is marked as a set, everything else item by
 * item. The result is the same review the IELTS app's result screens read.
 */

export interface GivenAnswer { itemId: string, answer: string }

/**
 * `module` is the test's (Academic and General Training Reading convert to bands differently). An
 * IELTS section gets a band, a Multilevel one a score out of 75; a single part practised on its own
 * gets neither in IELTS, only the right answers.
 */
export function markSection(section: any, given: Map<string, string>, module?: string | null) {
  const marks = new Map<string, boolean>()
  let correct = 0
  let total = 0
  for (const item of section.items ?? []) {
    for (const group of item.part?.groups ?? []) {
      const items = group.items ?? []
      const results = kindOf(group.type) === 'MULTI'
        ? markAsSet(items.map((q: any) => ({ key: q.acceptedAnswers, answer: given.get(q.id) })))
        : items.map((q: any) => isAnswerCorrect(group.type, q.acceptedAnswers, given.get(q.id)) === true)
      items.forEach((q: any, index: number) => {
        const points = q.points ?? 1
        total += points
        if (results[index]) correct += points
        marks.set(q.id, !!results[index])
      })
    }
  }
  const objective = section.skill === 'LISTENING' ? 'listening' : section.skill === 'READING' ? 'reading' : null
  const exam = examOfSection(section)
  if (exam === 'IELTS') {
    const whole = (section.items ?? []).filter((i: any) => i.part).length >= formatOf('IELTS')[section.skill as 'LISTENING' | 'READING']?.parts
    const band = objective && total && whole ? rawToBand(section.skill, module, correct, total) : null
    return { exam, marks, correct, total, score: null, band, cefrLevel: bandCefr(band) }
  }
  const score = objective && total ? sectionScore(objective, correct, section.settings) : null
  return { exam, marks, correct, total, score, band: null as number | null, cefrLevel: score == null ? null : cefrLevel(score) }
}

/** Every item id of a section, so answers to questions not in it are ignored. */
export function itemIdsOf(section: any) {
  const ids = new Set<string>()
  for (const item of section.items ?? []) for (const group of item.part?.groups ?? []) for (const q of group.items ?? []) ids.add(q.id)
  return ids
}

/**
 * The marked section as the result screens show it: every key, the answer given, right or wrong.
 * Without `explanations` (no Premium), the reasons and the lines in the passage that hold each
 * answer are left out, and `locked` says how many there were.
 */
export function reviewSection(section: any, opts: {
  explanations?: boolean
  given: Map<string, string>
  marks: Map<string, boolean>
  correct: number | null
  total: number | null
  score: number | null
  /** IELTS: the band, in place of a score. */
  band?: number | null
  essays?: Map<string, { id?: string, text: string, wordCount: number, feedback?: string | null }>
}) {
  const paper = paperSection(section, true)
  const withWhy = opts.explanations !== false
  let locked = 0
  const why = (from: any) => {
    if (withWhy) return from
    const { explanation, evidence, ...rest } = from
    if (explanation || evidence) locked++
    return rest
  }
  const parts = paper.parts.map((part: any) => ({
    ...part,
    groups: part.groups.map((group: any) => ({
      ...why(group),
      items: group.items.map((item: any) => ({
        ...why(item),
        answer: opts.given.get(item.id) ?? null,
        isCorrect: opts.marks.get(item.id) ?? false
      }))
    }))
  }))
  return {
    skill: paper.skill,
    title: paper.title,
    audioUrl: paper.audioUrl,
    exam: paper.exam,
    correct: opts.correct,
    total: opts.total,
    band: opts.band ?? null,
    score: opts.score,
    cefrLevel: opts.band != null ? bandCefr(opts.band) : opts.score == null ? null : cefrLevel(opts.score),
    estimated: opts.total != null && opts.total !== formatOf(paper.exam)[paper.skill as 'LISTENING' | 'READING']?.questions,
    parts,
    tasks: paper.tasks.map((task: any) => {
      const essay = opts.essays?.get(task.id)
      return {
        task,
        essay: essay
          ? { id: essay.id ?? task.id, text: essay.text, wordCount: essay.wordCount, criteria: null, band: null, feedback: essay.feedback ?? null, gradedAt: null, gradedBy: null, aiStatus: null, aiAssessment: null }
          : null
      }
    }),
    speaking: paper.speaking,
    locked
  }
}
