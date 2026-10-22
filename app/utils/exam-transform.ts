import type { AnswerMap, PartData } from '~/types/exam'
import { mediaUrl } from '~/services/http'
import type { IELTSQuestion, IELTSQuestionType, Part, QuestionGroup, WritingTask } from '~/types/ielts'

/**
 * Between the API's shape of a paper and the shape the question components and the question editor
 * were written for. The API keeps a group's numbered items with their accepted answers, and its
 * shared material (options, headings, a table) as structured content; the components read the
 * older "question with sub-questions" form. Both directions live here, so nothing else translates.
 */

/** Alternatives typed into one box, "colour / color" — but "12/05" is one date, not two answers. */
export function splitAlternatives(value?: string | null): string[] {
  if (!value) return []
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!
    if (ch === '/' && !(/\d/.test(value[i - 1] ?? '') && /\d/.test(value[i + 1] ?? ''))) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  parts.push(current)
  return parts.map(p => p.trim()).filter(Boolean)
}

export const joinAlternatives = (answers?: string[] | null) => (answers ?? []).join(' / ')

/** An API group as the question components draw it. Keys are only there when the API sent them. */
export function toRenderQuestion(group: QuestionGroup): IELTSQuestion {
  const items = [...(group.items ?? [])].sort((a, b) => a.number - b.number)
  const keys = new Set(items.flatMap(i => i.acceptedAnswers ?? []).map(k => k.trim().toLowerCase()))
  const options = (group.content?.options ?? []).map((o, i) => ({
    id: `${group.id}:${o.key}`, optionKey: o.key, optionText: o.text, orderIndex: i, isCorrect: keys.has(o.key.trim().toLowerCase())
  }))
  const headings = group.content?.headings?.length ? Object.fromEntries(group.content.headings.map(h => [h.key, h.text])) : undefined
  const single = group.type === 'MULTIPLE_CHOICE'
  // An uploaded picture for a labelling task is drawn from the group's HTML, as it always was.
  const image = group.content?.imageUrl ? `<p><img src="${mediaUrl(group.content.imageUrl)}" alt=""></p>` : ''
  return {
    id: group.id,
    type: group.type,
    instruction: group.instruction ?? undefined,
    questionNumber: items[0]?.number,
    questionText: single ? (items[0]?.prompt ?? group.context ?? '') : `${image}${group.context ?? ''}`,
    context: group.content?.lead ?? undefined,
    headingOptions: headings,
    tableData: group.content?.table,
    explanation: group.explanation ?? undefined,
    options,
    questions: single
      ? []
      : items.map((item, i) => ({
          id: item.id,
          questionNumber: item.number,
          questionText: item.prompt ?? undefined,
          correctAnswer: item.acceptedAnswers ? joinAlternatives(item.acceptedAnswers) : undefined,
          explanation: item.explanation ?? undefined,
          fromPassage: item.evidence ?? undefined,
          points: item.points,
          order: i + 1
        }))
  }
}

/** The question editor's group back into what the API saves. */
export function fromEditorQuestion(q: IELTSQuestion) {
  const type = q.type as IELTSQuestionType
  const single = type === 'MULTIPLE_CHOICE'
  const options = (q.options ?? []).filter(o => o.optionKey?.trim()).map(o => ({ key: o.optionKey.trim(), text: o.optionText ?? '' }))
  const content: Record<string, unknown> = {}
  if (options.length) content.options = options
  if (q.headingOptions && Object.keys(q.headingOptions).length) content.headings = Object.entries(q.headingOptions).map(([key, text]) => ({ key, text }))
  if (q.tableData?.headers?.length) content.table = q.tableData
  if (q.context) content.lead = q.context
  const items = single
    ? [{
        ...(q.questions?.[0]?.id ? { id: q.questions[0].id } : {}),
        number: q.questionNumber ?? 1,
        prompt: q.questionText ?? null,
        acceptedAnswers: (q.options ?? []).filter(o => o.isCorrect).map(o => o.optionKey),
        explanation: q.explanation ?? null,
        evidence: q.fromPassage ?? null
      }]
    : (q.questions ?? []).map(sub => ({
        ...(sub.id && !sub.id.includes(':') ? { id: sub.id } : {}),
        number: sub.questionNumber ?? 0,
        prompt: sub.questionText ?? null,
        acceptedAnswers: splitAlternatives(sub.correctAnswer),
        explanation: sub.explanation ?? null,
        evidence: sub.fromPassage ?? null,
        points: sub.points ?? 1
      }))
  return {
    type,
    instruction: q.instruction ?? null,
    context: single ? null : (q.questionText ?? null),
    content,
    explanation: single ? null : (q.explanation ?? null),
    items
  }
}

/** For the editor of a multiple-choice group: the item's id rides on questions[0]. */
export function toEditorQuestion(group: QuestionGroup): IELTSQuestion {
  const q = toRenderQuestion(group)
  if (group.type === 'MULTIPLE_CHOICE' && group.items[0]) {
    q.questions = [{ id: group.items[0].id, questionNumber: group.items[0].number }]
    q.explanation = group.items[0].explanation ?? undefined
    q.fromPassage = group.items[0].evidence ?? undefined
  }
  return q
}

export interface PartDataWithItems extends PartData {
  /** Question number → item id, for saving. */
  itemIds: Record<number, string>
}

function baseTransform(part: Part, verb: 'Read the text' | 'Listen'): PartDataWithItems {
  const groups = [...(part.groups ?? [])].sort((a, b) => a.position - b.position)
  const questions = groups.map(toRenderQuestion)
  const itemIds: Record<number, string> = {}
  for (const g of groups) for (const item of g.items) itemIds[item.number] = item.id
  const nums = Object.keys(itemIds).map(Number).sort((a, b) => a - b)
  const range: [number, number] = nums.length ? [nums[0]!, nums[nums.length - 1]!] : [0, 0]
  return {
    id: part.id,
    partLabel: `Part ${part.partNumber}`,
    title: part.title ?? '',
    instruction: range[0] > 0 ? `${verb} and answer questions ${range[0]}–${range[1]}.` : `${verb} and answer the questions.`,
    questions,
    totalQuestions: nums.length,
    questionRange: range,
    itemIds
  }
}

export function transformReadingPart(part: Part): PartDataWithItems {
  return { ...baseTransform(part, 'Read the text'), content: part.passage ?? '' }
}

export function transformListeningPart(part: Part): PartDataWithItems {
  return { ...baseTransform(part, 'Listen'), audioUrl: mediaUrl(part.audioUrl) || undefined, transcriptUrl: mediaUrl(part.transcriptUrl) || undefined }
}

export interface WritingPartData {
  id: string
  partLabel: string
  task: string
  prompt?: string
  image_url?: string
  min_words?: number
  suggested_time?: number
}

export function transformWritingTask(task: WritingTask & { minWords?: number | null }): WritingPartData {
  return {
    id: task.id,
    partLabel: writingTaskLabel(task.taskNumber, task.exam),
    task: `TASK_${task.taskNumber}`,
    prompt: task.prompt,
    image_url: mediaUrl(task.imageUrl) || undefined,
    min_words: task.minWords ?? writingDefaults(task.taskNumber, task.exam).minWords,
    suggested_time: task.suggestedMinutes ?? writingDefaults(task.taskNumber, task.exam).minutes
  }
}

/** Answers keyed by question number, as the components hold them, into what the API saves. */
export function answersPayload(answers: AnswerMap, parts: PartDataWithItems[]) {
  const ids: Record<number, string> = Object.assign({}, ...parts.map(p => p.itemIds))
  return Object.entries(answers)
    .filter(([n]) => ids[Number(n)])
    .map(([n, answer]) => ({ itemId: ids[Number(n)]!, answer: answer ?? '' }))
}

/** Saved answers keyed by item id, back into question numbers for the components. */
export function answersByNumber(saved: Record<string, string> | undefined, parts: PartDataWithItems[]): AnswerMap {
  const out: AnswerMap = {}
  if (!saved) return out
  for (const p of parts) for (const [n, id] of Object.entries(p.itemIds)) if (saved[id] != null) out[Number(n)] = saved[id]!
  return out
}

export function sortParts<T extends { partLabel: string }>(parts: T[]) {
  return [...parts].sort((a, b) => a.partLabel.localeCompare(b.partLabel))
}
