/**
 * Marking a submitted Listening or Reading section against its keys, as the erp-lms IELTS addon
 * does (ielts-attempts.service.ts finish): "choose TWO" is marked as a set, everything else item by
 * item. The result is the same review the IELTS app's result screens read.
 */

export interface GivenAnswer { itemId: string, answer: string }

export function markSection(section: any, given: Map<string, string>) {
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
  const score = objective && total ? sectionScore(objective, correct, total, section.settings) : null
  return { marks, correct, total, score, cefrLevel: score == null ? null : cefrLevel(score) }
}

/** Every item id of a section, so answers to questions not in it are ignored. */
export function itemIdsOf(section: any) {
  const ids = new Set<string>()
  for (const item of section.items ?? []) for (const group of item.part?.groups ?? []) for (const q of group.items ?? []) ids.add(q.id)
  return ids
}

/** The marked section as the result screens show it: every key, the answer given, right or wrong. */
export function reviewSection(section: any, opts: {
  given: Map<string, string>
  marks: Map<string, boolean>
  correct: number | null
  total: number | null
  score: number | null
  essays?: Map<string, { id?: string, text: string, wordCount: number, feedback?: string | null }>
}) {
  const paper = paperSection(section, true)
  return {
    skill: paper.skill,
    title: paper.title,
    audioUrl: paper.audioUrl,
    correct: opts.correct,
    total: opts.total,
    band: opts.score,
    score: opts.score,
    cefrLevel: opts.score == null ? null : cefrLevel(opts.score),
    estimated: opts.total != null && opts.total !== 35,
    parts: paper.parts.map((part: any) => ({
      ...part,
      groups: part.groups.map((group: any) => ({
        ...group,
        items: group.items.map((item: any) => ({
          ...item,
          answer: opts.given.get(item.id) ?? null,
          isCorrect: opts.marks.get(item.id) ?? false
        }))
      }))
    })),
    tasks: paper.tasks.map((task: any) => {
      const essay = opts.essays?.get(task.id)
      return {
        task,
        essay: essay
          ? { id: essay.id ?? task.id, text: essay.text, wordCount: essay.wordCount, criteria: null, band: null, feedback: essay.feedback ?? null, gradedAt: null, gradedBy: null, aiStatus: null, aiAssessment: null }
          : null
      }
    }),
    speaking: paper.speaking
  }
}
