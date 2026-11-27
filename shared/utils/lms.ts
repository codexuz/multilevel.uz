/**
 * Shared LMS types, metadata, content-drip evaluation, and text helpers for:
 * Course => Units/Modules => Lessons => Exercises => Questions (12 question types).
 */

export const DRIP_MODES = ['ALWAYS_OPEN', 'DATE_RANGE', 'SEQUENTIAL'] as const
export type DripMode = (typeof DRIP_MODES)[number]

export const EXERCISE_TYPES = ['PRACTICE', 'QUIZ', 'HOMEWORK', 'SPEAKING'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export const LMS_QUESTION_TYPE_LIST = [
  'SENTENCE_BUILD',
  'ERROR_SPOT',
  'MCQ',
  'SINGLE_CHOICE',
  'SHORT_ANSWER',
  'NOTE_COMPLETION',
  'SUMMARY_COMPLETION',
  'SUMMARY_DRAG_DROP',
  'TRUE_FALSE',
  'ORDER',
  'TRANSLATION',
  'DICTATION',
  'WRITTEN_RESPONSE'
] as const

export type LmsQuestionType = (typeof LMS_QUESTION_TYPE_LIST)[number]

export interface LmsQuestionTypeMeta {
  type: LmsQuestionType
  label: string
  shortLabel: string
  icon: string
  category: 'Choice' | 'Completion' | 'Construct' | 'Language'
  description: string
}

export const LMS_QUESTION_META: Record<LmsQuestionType, LmsQuestionTypeMeta> = {
  SENTENCE_BUILD: {
    type: 'SENTENCE_BUILD',
    label: 'Sentence Build',
    shortLabel: 'Sentence Build',
    icon: 'i-lucide-blocks',
    category: 'Construct',
    description: 'Assemble words and phrases from a scrambled word bank into a grammatical sentence.'
  },
  ERROR_SPOT: {
    type: 'ERROR_SPOT',
    label: 'Error Spot',
    shortLabel: 'Error Spot',
    icon: 'i-lucide-search-x',
    category: 'Language',
    description: 'Identify the incorrect word or segment in a sentence and optionally provide the correction.'
  },
  MCQ: {
    type: 'MCQ',
    label: 'Multiple Choice (MCQ)',
    shortLabel: 'MCQ',
    icon: 'i-lucide-list-checks',
    category: 'Choice',
    description: 'Select one or more correct answers from multiple choices.'
  },
  SINGLE_CHOICE: {
    type: 'SINGLE_CHOICE',
    label: 'Single Choice',
    shortLabel: 'Single Choice',
    icon: 'i-lucide-circle-dot',
    category: 'Choice',
    description: 'Pick the single best answer from the options.'
  },
  SHORT_ANSWER: {
    type: 'SHORT_ANSWER',
    label: 'Short Answer',
    shortLabel: 'Short Answer',
    icon: 'i-lucide-text-cursor-input',
    category: 'Completion',
    description: 'Type a concise word or phrase answer (supports flexible alternatives and word limits).'
  },
  NOTE_COMPLETION: {
    type: 'NOTE_COMPLETION',
    label: 'Note Completion',
    shortLabel: 'Note Completion',
    icon: 'i-lucide-notebook-pen',
    category: 'Completion',
    description: 'Fill in missing information across structured bullet-point notes using {{1}}, {{2}} gaps.'
  },
  SUMMARY_COMPLETION: {
    type: 'SUMMARY_COMPLETION',
    label: 'Summary Completion',
    shortLabel: 'Summary Fill',
    icon: 'i-lucide-file-pen-line',
    category: 'Completion',
    description: 'Complete a summary paragraph by typing the missing words into inline {{1}}, {{2}} gaps.'
  },
  SUMMARY_DRAG_DROP: {
    type: 'SUMMARY_DRAG_DROP',
    label: 'Summary Drag & Drop',
    shortLabel: 'Drag & Drop',
    icon: 'i-lucide-grip-horizontal',
    category: 'Completion',
    description: 'Drag or click words from a word bank into numbered summary blanks.'
  },
  TRUE_FALSE: {
    type: 'TRUE_FALSE',
    label: 'True / False',
    shortLabel: 'True / False',
    icon: 'i-lucide-check-circle-2',
    category: 'Choice',
    description: 'Decide whether a statement is True or False (with optional Not Given).'
  },
  ORDER: {
    type: 'ORDER',
    label: 'Ordering / Sequence',
    shortLabel: 'Order',
    icon: 'i-lucide-arrow-up-down',
    category: 'Construct',
    description: 'Arrange shuffled sentences, paragraphs, or steps into the right logical order.'
  },
  TRANSLATION: {
    type: 'TRANSLATION',
    label: 'Translation',
    shortLabel: 'Translation',
    icon: 'i-lucide-languages',
    category: 'Language',
    description: 'Translate a sentence or expression between languages with flexible accepted answers.'
  },
  DICTATION: {
    type: 'DICTATION',
    label: 'Dictation',
    shortLabel: 'Dictation',
    icon: 'i-lucide-headphones',
    category: 'Language',
    description: 'Listen to a clip, or to timed segments of a recording, video or YouTube video, and write down what you hear.'
  },
  WRITTEN_RESPONSE: {
    type: 'WRITTEN_RESPONSE',
    label: 'Written Response',
    shortLabel: 'Written',
    icon: 'i-lucide-pen-line',
    category: 'Language',
    description: 'Summarise an article, describe a picture or answer a prompt in writing; marked by AI against key points, then by the teacher.'
  }
}

export const LMS_QUESTION_OPTIONS = LMS_QUESTION_TYPE_LIST.map(t => LMS_QUESTION_META[t])

export const DRIP_MODE_META: Record<DripMode, { label: string, description: string, icon: string }> = {
  ALWAYS_OPEN: {
    label: 'Always open',
    description: 'All units and lessons are immediately available once enrolled.',
    icon: 'i-lucide-unlock'
  },
  DATE_RANGE: {
    label: 'Specific date (from – to)',
    description: 'Unlock units or lessons inside a scheduled start and optional end date.',
    icon: 'i-lucide-calendar-clock'
  },
  SEQUENTIAL: {
    label: 'Sequential (one after another)',
    description: 'Automatically unlock each lesson as soon as the student finishes the previous one.',
    icon: 'i-lucide-list-checks'
  }
}

export interface LmsOptionItem {
  key: string
  text: string
}

export interface LmsOrderItem {
  id: string
  text: string
}

export interface LmsQuestionConfig {
  /** SENTENCE_BUILD: target words (and optional distractors). */
  words?: string[]
  distractors?: string[]
  /** ERROR_SPOT: error token index (0-based word index in context) and whether student must type the fix. */
  errorIndex?: number
  requireCorrection?: boolean
  /** MCQ / SINGLE_CHOICE: choices */
  options?: LmsOptionItem[]
  /** SHORT_ANSWER / NOTE_COMPLETION / SUMMARY_COMPLETION */
  wordLimit?: number | null
  placeholder?: string
  /** SUMMARY_DRAG_DROP: reusable or single-use word bank */
  wordBank?: LmsOptionItem[]
  reuseWords?: boolean
  /** TRUE_FALSE: whether NOT_GIVEN is also offered */
  allowNotGiven?: boolean
  /** ORDER: items in the CORRECT sequence (shuffled for learners) */
  items?: LmsOrderItem[]
  /** TRANSLATION: language codes and optional hint */
  sourceLang?: string
  targetLang?: string
  hint?: string
  /** DICTATION: text for built-in Web Speech TTS fallback + max replays (per segment with segments) */
  ttsText?: string
  ttsLang?: string
  maxPlays?: number | null
  /**
   * DICTATION from a recording: a YouTube address (otherwise the uploaded `audioRef`, audio or video),
   * cut into timed segments; each segment's text is its accepted answer (acceptedAnswers[segment.id]).
   */
  youtubeUrl?: string | null
  segments?: LmsDictationSegment[]
  /** DICTATION from a video file: play the sound only. */
  audioOnly?: boolean
  /** WRITTEN_RESPONSE: what is asked; the article is the question's context, the picture its imageRef. */
  mode?: WrittenMode
  minWords?: number | null
  maxWords?: number | null
  /** WRITTEN_RESPONSE (teacher only): the ideas a good answer covers, and a model answer. */
  keyPoints?: string[]
  modelAnswer?: string
}

/** One timed piece of a dictation recording, in seconds. */
export interface LmsDictationSegment { id: string, start: number, end: number }

export const WRITTEN_MODES = ['SUMMARY', 'DESCRIBE_IMAGE', 'RESPONSE'] as const
export type WrittenMode = (typeof WRITTEN_MODES)[number]

/** The marking of a written response: the AI's, then (if they look at it) the teacher's. */
export interface WrittenReview {
  /** AI: marked by the AI; PENDING: waiting for the teacher (the AI could not mark it); TEACHER: the teacher's mark. */
  status: 'AI' | 'PENDING' | 'TEACHER'
  /** 0..100 */
  score?: number
  words: number
  feedback?: string
  criteria?: Array<{ key: 'content' | 'ownWords' | 'language' | 'organisation', score: number, comment: string }>
  keyPoints?: Array<{ point: string, covered: 'YES' | 'PARTLY' | 'NO' }>
  /** Phrases taken word for word from the article, and how much of the answer they make. */
  copied?: { percent: number, phrases: string[] }
  teacherComment?: string
  aiScore?: number
}

/**
 * Accepted answers:
 * - Single-response types: string[] (e.g. ['A', 'C'] for MCQ, ['TRUE'] for TRUE_FALSE, ['He went home.'] for SENTENCE_BUILD)
 * - Multi-gap types (NOTE_COMPLETION, SUMMARY_COMPLETION, SUMMARY_DRAG_DROP): Record<string, string[]> keyed by gap number ('1', '2', ...)
 */
export type LmsAcceptedAnswers = string[] | Record<string, string[]>

export interface LmsQuestionDto {
  id: string
  exerciseId: string
  position: number
  type: LmsQuestionType
  prompt: string
  context: string | null
  audioRef: string | null
  imageRef: string | null
  config: LmsQuestionConfig
  /** Omitted for students before submission; present for teachers/admins and in review. */
  acceptedAnswers?: LmsAcceptedAnswers
  explanation?: string | null
  points: number
}

export interface LmsExerciseDto {
  id: string
  lessonId: string
  position: number
  title: string
  instructions: string | null
  exerciseType: ExerciseType
  passingScore: number
  timeLimitSeconds: number | null
  maxAttempts: number | null
  shuffleQuestions: boolean
  showFeedback: 'IMMEDIATE' | 'AFTER_SUBMIT'
  requiredForCompletion: boolean
  questionCount?: number
  questions?: LmsQuestionDto[]
}

export interface LmsQuestionGrade {
  earned: number
  max: number
  isCorrect: boolean
  /** Per-gap results for completion/drag-drop, or per-item for ORDER, or word diff for DICTATION. */
  blanks?: Record<string, { given: string, correct: boolean, expected: string[] }>
  diff?: Array<{ word: string, status: 'match' | 'missing' | 'extra' }>
  /** DICTATION with segments: each segment's word diff and accuracy (0..1). */
  segments?: Record<string, { given: string, expected: string, diff: Array<{ word: string, status: 'match' | 'missing' | 'extra' }>, accuracy: number, exact: boolean }>
  /** WRITTEN_RESPONSE */
  review?: WrittenReview
  errorSpot?: { selectedIndex: number | null, expectedIndex: number, indexCorrect: boolean, correctionCorrect?: boolean }
  expected?: unknown
  explanation?: string | null
}

export interface DripState {
  locked: boolean
  reason: 'DATE_NOT_STARTED' | 'DATE_EXPIRED' | 'PREVIOUS_INCOMPLETE' | null
  effectiveMode: DripMode
  availableFrom: string | null
  availableTo: string | null
  previousLessonId?: string | null
  previousLessonTitle?: string | null
}

export function isLmsQuestionType(value: unknown): value is LmsQuestionType {
  return typeof value === 'string' && (LMS_QUESTION_TYPE_LIST as readonly string[]).includes(value)
}

export function isDripMode(value: unknown): value is DripMode {
  return typeof value === 'string' && (DRIP_MODES as readonly string[]).includes(value)
}

/** Extract sorted unique gap numbers from text containing {{1}}, {{2}} placeholders. */
export function parseGapNumbers(text: string | null | undefined): string[] {
  if (!text) return []
  const found = new Set<string>()
  for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    if (m[1]) found.add(m[1])
  }
  return [...found].sort((a, b) => Number(a) - Number(b))
}

export type GapSegment = { kind: 'text', value: string } | { kind: 'gap', number: string }

/** Split text with {{1}} placeholders into renderable text and gap tokens. */
export function splitByGaps(text: string | null | undefined): GapSegment[] {
  if (!text) return []
  const parts: GapSegment[] = []
  let last = 0
  for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push({ kind: 'text', value: text.slice(last, idx) })
    parts.push({ kind: 'gap', number: m[1]! })
    last = idx + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

/** Split an Error Spot sentence into clickable word tokens preserving punctuation visually. */
export function tokenizeErrorSentence(sentence: string | null | undefined): string[] {
  return String(sentence ?? '').trim().split(/\s+/).filter(Boolean)
}

/**
 * Evaluate content drip lock state for a lesson given its course, optional module,
 * previous lesson completion status, and current timestamp.
 */
export function computeDripState(params: {
  courseDripMode: string | null | undefined
  courseStartAt?: Date | string | null
  courseEndAt?: Date | string | null
  moduleDripMode?: string | null
  moduleFrom?: Date | string | null
  moduleTo?: Date | string | null
  lessonFrom?: Date | string | null
  lessonTo?: Date | string | null
  prevLesson?: { id: string, title: string, done: boolean } | null
  now?: Date
}): DripState {
  const now = params.now ?? new Date()
  const rawMode = params.moduleDripMode || params.courseDripMode || 'ALWAYS_OPEN'
  const effectiveMode: DripMode = isDripMode(rawMode) ? rawMode : 'ALWAYS_OPEN'

  const toDate = (v: Date | string | null | undefined): Date | null => {
    if (!v) return null
    const d = v instanceof Date ? v : new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // Most specific date window wins (lesson -> module -> course).
  const from = toDate(params.lessonFrom) ?? toDate(params.moduleFrom) ?? toDate(params.courseStartAt)
  const to = toDate(params.lessonTo) ?? toDate(params.moduleTo) ?? toDate(params.courseEndAt)

  const base = {
    effectiveMode,
    availableFrom: from ? from.toISOString() : null,
    availableTo: to ? to.toISOString() : null
  }

  if (effectiveMode === 'ALWAYS_OPEN') {
    return { ...base, locked: false, reason: null }
  }

  if (effectiveMode === 'DATE_RANGE') {
    if (from && now < from) return { ...base, locked: true, reason: 'DATE_NOT_STARTED' }
    if (to && now > to) return { ...base, locked: true, reason: 'DATE_EXPIRED' }
    return { ...base, locked: false, reason: null }
  }

  // SEQUENTIAL: also honor explicit lesson/module date window if configured, then enforce previous lesson completion.
  if (from && now < from) return { ...base, locked: true, reason: 'DATE_NOT_STARTED' }
  if (to && now > to) return { ...base, locked: true, reason: 'DATE_EXPIRED' }
  if (params.prevLesson && !params.prevLesson.done) {
    return {
      ...base,
      locked: true,
      reason: 'PREVIOUS_INCOMPLETE',
      previousLessonId: params.prevLesson.id,
      previousLessonTitle: params.prevLesson.title
    }
  }
  return { ...base, locked: false, reason: null }
}

/** Deterministic Fisher-Yates shuffle seeded from a string (e.g. question ID). */
export function shuffleDeterministic<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items]
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const next = () => {
    h += 0x6D2B79F5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** Word-level LCS diff for Dictation feedback. */
export function diffDictationWords(expectedText: string, actualText: string): Array<{ word: string, status: 'match' | 'missing' | 'extra' }> {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9'\u0400-\u04FF\s-]/gi, ' ').split(/\s+/).filter(Boolean)
  const a = clean(expectedText)
  const b = clean(actualText)
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? 1 + dp[i + 1]![j + 1]! : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const out: Array<{ word: string, status: 'match' | 'missing' | 'extra' }> = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ word: a[i]!, status: 'match' })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ word: a[i]!, status: 'missing' })
      i++
    } else {
      out.push({ word: b[j]!, status: 'extra' })
      j++
    }
  }
  while (i < m) out.push({ word: a[i++]!, status: 'missing' })
  while (j < n) out.push({ word: b[j++]!, status: 'extra' })
  return out
}

/** Default starter config + accepted answers when a teacher adds a new question of a given type. */
export function defaultQuestionTemplate(type: LmsQuestionType): {
  prompt: string
  context: string | null
  config: LmsQuestionConfig
  acceptedAnswers: LmsAcceptedAnswers
} {
  switch (type) {
    case 'SENTENCE_BUILD':
      return {
        prompt: 'Arrange the words to build a grammatically correct sentence.',
        context: null,
        config: { words: ['She', 'has', 'been', 'studying', 'English', 'for', 'three', 'years.'], distractors: [] },
        acceptedAnswers: ['She has been studying English for three years.']
      }
    case 'ERROR_SPOT':
      return {
        prompt: 'Click the word that contains a grammatical error and write the correction.',
        context: 'She go to the university library every morning.',
        config: { errorIndex: 1, requireCorrection: true },
        acceptedAnswers: ['goes']
      }
    case 'MCQ':
      return {
        prompt: 'Select all correct options.',
        context: null,
        config: { options: [{ key: 'A', text: 'Option A' }, { key: 'B', text: 'Option B' }, { key: 'C', text: 'Option C' }, { key: 'D', text: 'Option D' }] },
        acceptedAnswers: ['A', 'C']
      }
    case 'SINGLE_CHOICE':
      return {
        prompt: 'Choose the best answer.',
        context: null,
        config: { options: [{ key: 'A', text: 'Option A' }, { key: 'B', text: 'Option B' }, { key: 'C', text: 'Option C' }, { key: 'D', text: 'Option D' }] },
        acceptedAnswers: ['A']
      }
    case 'SHORT_ANSWER':
      return {
        prompt: 'Write a short answer to the question.',
        context: null,
        config: { wordLimit: 3, placeholder: 'Type your answer...' },
        acceptedAnswers: ['answer']
      }
    case 'NOTE_COMPLETION':
      return {
        prompt: 'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.',
        context: '• Venue: {{1}} Hall\n• Time: {{2}} AM\n• Required item: {{3}}',
        config: { wordLimit: 2 },
        acceptedAnswers: { 1: ['Main'], 2: ['9', 'nine'], 3: ['notebook'] }
      }
    case 'SUMMARY_COMPLETION':
      return {
        prompt: 'Complete the summary below by typing the missing words.',
        context: 'Regular reading improves {{1}} and expands academic {{2}} significantly over time.',
        config: { wordLimit: 2 },
        acceptedAnswers: { 1: ['comprehension'], 2: ['vocabulary'] }
      }
    case 'SUMMARY_DRAG_DROP':
      return {
        prompt: 'Complete the summary by dragging the correct words from the box.',
        context: 'Urban green spaces help reduce {{1}} and improve community {{2}}.',
        config: {
          wordBank: [
            { key: 'A', text: 'pollution' },
            { key: 'B', text: 'well-being' },
            { key: 'C', text: 'traffic' },
            { key: 'D', text: 'population' }
          ],
          reuseWords: false
        },
        acceptedAnswers: { 1: ['A'], 2: ['B'] }
      }
    case 'TRUE_FALSE':
      return {
        prompt: 'Decide whether the statement is True or False.',
        context: 'The present perfect tense is used to describe experiences at an unspecified time in the past.',
        config: { allowNotGiven: false },
        acceptedAnswers: ['TRUE']
      }
    case 'ORDER':
      return {
        prompt: 'Put the steps in the correct logical order.',
        context: null,
        config: {
          items: [
            { id: 'step-1', text: 'Brainstorm key ideas and plan your outline.' },
            { id: 'step-2', text: 'Write a clear introduction with a thesis statement.' },
            { id: 'step-3', text: 'Develop body paragraphs with supporting evidence.' },
            { id: 'step-4', text: 'Review grammar, vocabulary, and cohesion.' }
          ]
        },
        acceptedAnswers: ['step-1', 'step-2', 'step-3', 'step-4']
      }
    case 'TRANSLATION':
      return {
        prompt: 'Translate the sentence below into English.',
        context: 'Men har kuni ingliz tilini mashq qilaman.',
        config: { sourceLang: 'UZ', targetLang: 'EN', hint: '' },
        acceptedAnswers: ['I practice English every day.', 'I practise English every day.']
      }
    case 'DICTATION':
      return {
        prompt: 'Listen carefully and type the exact sentence you hear.',
        context: null,
        config: { ttsText: 'Effective communication requires both clear speaking and active listening.', ttsLang: 'en-GB', maxPlays: null },
        acceptedAnswers: ['Effective communication requires both clear speaking and active listening.']
      }
    case 'WRITTEN_RESPONSE':
      return {
        prompt: 'Read the article and write a summary of its main ideas in your own words.',
        context: null,
        config: { mode: 'SUMMARY', minWords: 60, maxWords: 120, keyPoints: [], modelAnswer: '' },
        acceptedAnswers: []
      }
  }
}
