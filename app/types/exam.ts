import type { IELTSQuestion } from './ielts'

export type AnswerMap = Record<number, string>

export interface PartData {
  id: string
  partLabel: string
  title?: string
  content?: string
  instruction?: string
  audioUrl?: string
  transcriptUrl?: string
  questions: IELTSQuestion[]
  totalQuestions: number
  questionRange: [number, number]
}

export type AttemptScope = 'TEST' | 'MODULE' | 'PART' | 'TASK'
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'ABANDONED'

export interface Attempt {
  id: string
  scope: AttemptScope
  status: AttemptStatus
  test_id?: string
  module_id?: string
  part_id?: string
  task_id?: string
  started_at?: string
  submitted_at?: string
}

export interface PartQuestionMapping {
  partId: string
  questionIds: Record<number, string>
}

export interface QuestionResult {
  questionId: string
  questionNumber: number
  questionType: string
  questionText: string | null
  userAnswer: string | null
  correctAnswer: string
  isCorrect: boolean | null
  points: number
  earnedPoints: number | null
  explanation: string | null
  fromPassage: string | null
  questionParts: unknown[]
  answerText: string | null
  optionText: string | null
}

export interface WritingScore {
  task_response: number | null
  lexical_resources: number | null
  grammar_range_and_accuracy: number | null
  coherence_and_cohesion: number | null
  overall: number | null
}

export interface WritingAnswerResult {
  id?: string
  taskId: string
  taskNumber: number
  answerText: string
  wordCount: number
  score: WritingScore | null
  feedback: string | null
  // AI examiner (runs automatically after submission)
  aiStatus?: 'queued' | 'processing' | 'completed' | 'failed' | null
  aiError?: string | null
}

export interface AttemptResult {
  attemptId: string
  scope?: string
  partId?: string
  part_id?: string
  moduleId?: string
  module_id?: string
  testId?: string
  test_id?: string
  readingId?: string
  listeningId?: string
  writingId?: string
  userId: string
  totalQuestions: number
  correctAnswers: number
  totalPoints: number
  earnedPoints: number
  score: number
  ieltsBandScore: number
  timeSpentMinutes: number
  isCompleted: boolean
  startedAt: string
  completedAt: string | null
  questionResults: QuestionResult[]
  writingAnswers: WritingAnswerResult[]
}

export interface WritingTaskDetail {
  id: string
  task: string
  prompt: string | null
  min_words: number | null
  suggested_time: number | null
  image_url: string | null
}
