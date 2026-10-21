import type { IELTSQuestionType } from '~/types/ielts'

export const QUESTION_TYPES: { value: IELTSQuestionType, label: string, icon: string }[] = [
  { value: 'TRUE_FALSE_NOT_GIVEN', label: 'True / False / Not Given', icon: 'i-lucide-circle-check-big' },
  { value: 'YES_NO_NOT_GIVEN', label: 'Yes / No / Not Given', icon: 'i-lucide-circle-check-big' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: 'i-lucide-list-checks' },
  { value: 'MULTIPLE_ANSWER', label: 'Multiple Answer', icon: 'i-lucide-list-todo' },
  { value: 'NOTE_COMPLETION', label: 'Note Completion', icon: 'i-lucide-notebook-pen' },
  { value: 'SENTENCE_COMPLETION', label: 'Sentence Completion', icon: 'i-lucide-text-cursor-input' },
  { value: 'SUMMARY_COMPLETION', label: 'Summary Completion', icon: 'i-lucide-file-text' },
  { value: 'SUMMARY_COMPLETION_DRAG_DROP', label: 'Summary Completion (Drag & Drop)', icon: 'i-lucide-grip' },
  { value: 'SHORT_ANSWER', label: 'Short Answer', icon: 'i-lucide-message-square-text' },
  { value: 'TABLE_COMPLETION', label: 'Table Completion', icon: 'i-lucide-table' },
  { value: 'FLOW_CHART_COMPLETION', label: 'Flow Chart Completion', icon: 'i-lucide-workflow' },
  { value: 'DIAGRAM_LABELLING', label: 'Diagram Labelling', icon: 'i-lucide-image' },
  { value: 'MATCHING_HEADINGS', label: 'Matching Headings', icon: 'i-lucide-heading' },
  { value: 'MATCHING_INFORMATION', label: 'Matching Information', icon: 'i-lucide-git-compare' },
  { value: 'MATCHING_FEATURES', label: 'Matching Features', icon: 'i-lucide-git-compare' },
  { value: 'MATCHING_SENTENCE_ENDINGS', label: 'Matching Sentence Endings', icon: 'i-lucide-git-compare' },
  { value: 'PLAN_MAP_LABELLING', label: 'Plan / Map Labelling', icon: 'i-lucide-map' }
]

export const questionTypeLabel = (t?: string) => (t ? i18nT(`qtype.${t}`, {}, QUESTION_TYPES.find(q => q.value === t)?.label ?? t.replace(/_/g, ' ')) : '')
export const questionTypeIcon = (t?: string) => QUESTION_TYPES.find(q => q.value === t)?.icon ?? 'i-lucide-help-circle'

/** Every type uses sub-questions except MULTIPLE_CHOICE (options only). */
export const usesSubQuestions = (t: IELTSQuestionType) => t !== 'MULTIPLE_CHOICE'

export const usesOptions = (t: IELTSQuestionType) => ([
  'MULTIPLE_CHOICE',
  'MULTIPLE_ANSWER',
  'SUMMARY_COMPLETION_DRAG_DROP',
  'MATCHING_FEATURES',
  'MATCHING_SENTENCE_ENDINGS',
  'PLAN_MAP_LABELLING'
] as IELTSQuestionType[]).includes(t)

export const usesHeadingOptions = (t: IELTSQuestionType) => t === 'MATCHING_HEADINGS' || t === 'MATCHING_INFORMATION'

export type AnswerMode = 'text' | 'tfng' | 'ynng' | 'option-key' | 'heading-key'

export function answerMode(t: IELTSQuestionType): AnswerMode {
  if (t === 'TRUE_FALSE_NOT_GIVEN') return 'tfng'
  if (t === 'YES_NO_NOT_GIVEN') return 'ynng'
  if (usesHeadingOptions(t)) return 'heading-key'
  if (usesOptions(t) && t !== 'MULTIPLE_CHOICE') return 'option-key'
  return 'text'
}

export const DEFAULT_INSTRUCTIONS: Record<IELTSQuestionType, string> = {
  TRUE_FALSE_NOT_GIVEN: 'Do the following statements agree with the information given in the passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.',
  YES_NO_NOT_GIVEN: 'Do the following statements agree with the views of the writer? Write YES if the statement agrees with the views of the writer, NO if the statement contradicts the views of the writer, NOT GIVEN if it is impossible to say what the writer thinks about this.',
  MULTIPLE_CHOICE: 'Choose the correct letter, A, B, C or D.',
  MULTIPLE_ANSWER: 'Choose THREE correct answers.',
  NOTE_COMPLETION: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
  SENTENCE_COMPLETION: 'Complete the sentences below. Write NO MORE THAN TWO WORDS from the passage for each answer.',
  SUMMARY_COMPLETION: 'Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  SUMMARY_COMPLETION_DRAG_DROP: 'Complete the summary using the list of words below.',
  SHORT_ANSWER: 'Answer the questions below. Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.',
  TABLE_COMPLETION: 'Complete the table below. Write NO MORE THAN ONE WORD AND/OR A NUMBER for each answer.',
  FLOW_CHART_COMPLETION: 'Complete the flow chart below. Write NO MORE THAN TWO WORDS for each answer.',
  DIAGRAM_LABELLING: 'Label the diagram below. Write NO MORE THAN TWO WORDS from the passage for each answer.',
  MATCHING_HEADINGS: 'Choose the correct heading for each paragraph from the list of headings below.',
  MATCHING_INFORMATION: 'Which paragraph contains the following information? Write the correct letter, A–F.',
  MATCHING_FEATURES: 'Match each statement with the correct option, A, B or C.',
  MATCHING_SENTENCE_ENDINGS: 'Complete each sentence with the correct ending, A–F, below.',
  PLAN_MAP_LABELLING: 'Label the map below. Choose your answers from the box and write the correct letter next to the questions.'
}

export const TYPE_HINTS: Partial<Record<IELTSQuestionType, string>> = {
  TRUE_FALSE_NOT_GIVEN: 'Add statements as sub-questions. Correct answer must be TRUE, FALSE, or NOT GIVEN.',
  YES_NO_NOT_GIVEN: 'Add statements as sub-questions. Correct answer must be YES, NO, or NOT GIVEN.',
  MULTIPLE_CHOICE: 'Options only – no sub-questions. Exactly one option must be marked as correct.',
  MULTIPLE_ANSWER: 'Options + sub-questions. Multiple options can be correct. Sub-question answer = option key.',
  NOTE_COMPLETION: 'Each blank is a sub-question. Correct answer = text from the passage.',
  SENTENCE_COMPLETION: 'Each incomplete sentence is a sub-question. Correct answer = text from the passage.',
  SUMMARY_COMPLETION: 'Each blank in the summary is a sub-question. Correct answer = words from the passage.',
  SUMMARY_COMPLETION_DRAG_DROP: 'Options are the word bank. Sub-question answer must match an option key (A, B, C…).',
  SHORT_ANSWER: 'Each question gets a free text answer.',
  TABLE_COMPLETION: 'Define table headers & rows. Use ____ for blanks. Each blank = a sub-question.',
  FLOW_CHART_COMPLETION: 'Use the question text for the flow chart. Each blank = a sub-question.',
  DIAGRAM_LABELLING: 'Use the question text for the diagram image. Each label = a sub-question.',
  MATCHING_HEADINGS: 'Define heading options (roman numerals). Sub-question answer = heading key.',
  MATCHING_INFORMATION: 'Define paragraph options (A, B, C…). Sub-question answer = paragraph key.',
  MATCHING_FEATURES: 'Options = features/people to match. Sub-question answer = option key.',
  MATCHING_SENTENCE_ENDINGS: 'Options = sentence endings. Sub-question answer = option key.',
  PLAN_MAP_LABELLING: 'Options = location labels. Sub-question answer = option key.'
}

export function optionsLabel(t: IELTSQuestionType) {
  switch (t) {
    case 'MULTIPLE_CHOICE': return 'Options (one correct)'
    case 'MULTIPLE_ANSWER': return 'Options (multiple correct)'
    case 'SUMMARY_COMPLETION_DRAG_DROP': return 'Word bank'
    case 'MATCHING_FEATURES': return 'Features / categories'
    case 'MATCHING_SENTENCE_ENDINGS': return 'Sentence endings'
    case 'PLAN_MAP_LABELLING': return 'Location labels'
    default: return 'Options'
  }
}

export function subQuestionsLabel(t: IELTSQuestionType) {
  switch (t) {
    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN': return 'Statements'
    case 'MATCHING_INFORMATION': return 'Statements (match to paragraph)'
    case 'MATCHING_HEADINGS': return 'Paragraphs (match to heading)'
    case 'MATCHING_FEATURES': return 'Statements (match to feature)'
    case 'MATCHING_SENTENCE_ENDINGS': return 'Sentence beginnings'
    default: return 'Sub-questions'
  }
}

export function questionTextLabel(t: IELTSQuestionType) {
  if (['NOTE_COMPLETION', 'SUMMARY_COMPLETION', 'SUMMARY_COMPLETION_DRAG_DROP', 'FLOW_CHART_COMPLETION'].includes(t)) return 'Question text (use ____ for blanks)'
  if (t === 'DIAGRAM_LABELLING' || t === 'PLAN_MAP_LABELLING') return 'Question text (diagram / map image)'
  return 'Question text'
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']

export function nextHeadingKey(t: IELTSQuestionType, index: number) {
  return t === 'MATCHING_INFORMATION' ? String.fromCharCode(65 + index) : (ROMAN[index] ?? `h${index + 1}`)
}

export const MODE_ITEMS = [{ label: 'Practice', value: 'PRACTICE' }, { label: 'Mock', value: 'MOCK' }]
export const MODULE_ITEMS = [{ label: 'Academic', value: 'ACADEMIC' }, { label: 'General Training', value: 'GENERAL_TRAINING' }]
export const STATUS_META: Record<string, { label: string, color: 'neutral' | 'success' | 'warning' }> = {
  DRAFT: { label: 'Draft', color: 'neutral' },
  PUBLISHED: { label: 'Published', color: 'success' },
  ARCHIVED: { label: 'Archived', color: 'warning' }
}
export const CATEGORY_ITEMS = [
  { label: 'None', value: null },
  { label: 'Authentic', value: 'AUTHENTIC' },
  { label: 'Official sample', value: 'OFFICIAL' },
  { label: 'Practice book', value: 'BOOK' },
  { label: 'Custom', value: 'CUSTOM' }
]
export const categoryLabel = (value?: string | null) => (value ? i18nT(`category.${value}`, {}, CATEGORY_ITEMS.find(c => c.value === value)?.label ?? '') : '')
export const DIFFICULTY_ITEMS = [{ label: 'Easy', value: 'EASY' }, { label: 'Medium', value: 'MEDIUM' }, { label: 'Hard', value: 'HARD' }]

export const SKILL_META = {
  LISTENING: { label: 'Listening', icon: 'i-lucide-headphones', color: 'warning', parts: 6 },
  READING: { label: 'Reading', icon: 'i-lucide-book-open', color: 'secondary', parts: 5 },
  WRITING: { label: 'Writing', icon: 'i-lucide-pen-line', color: 'success', parts: 3 },
  SPEAKING: { label: 'Speaking', icon: 'i-lucide-mic', color: 'info', parts: 4 }
} as const
export const SKILL_ORDER = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const
