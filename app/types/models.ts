// API DTO shapes (camelCase, as returned by the /api/* endpoints). These mirror the
// Drizzle schema in server/database/schema.ts but are hand-declared so the client has
// no server-only imports.
import type {
  UserRole, TestStatus, SectionType, QuestionType, AttemptStatus,
  SubPlan, SubStatus, Choice, QuestionMeta
} from './exam'

export interface Me {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: UserRole
  currentLevel: string | null
  learningDuration: string | null
  targetLevel: string | null
  targetScore: number | null
  onboarded: boolean
  points: number
  coins: number
  streakCount: number
  isPremium: boolean
}

export interface TestDto {
  id: string
  title: string
  description: string | null
  level: string | null
  status: TestStatus
  isPremium: boolean
  createdAt: string
}

export interface SectionDto {
  id: string
  testId: string
  type: SectionType
  title: string
  durationMinutes: number
  orderIndex: number
  audioUrl: string | null
}

export interface PartDto {
  id: string
  sectionId: string
  title: string
  instructions: string | null
  content: { passage?: string } & Record<string, unknown>
  audioUrl: string | null
  orderIndex: number
}

// Student-facing question — no correctAnswer.
export interface StudentQuestionDto {
  id: string
  partId: string
  orderIndex: number
  questionNumber: number | null
  type: QuestionType
  prompt: string | null
  options: Choice[]
  points: number
  meta: QuestionMeta
}

// Full question (admin/grading) — includes correctAnswer.
export interface QuestionDto extends StudentQuestionDto {
  correctAnswer: unknown
}

export interface AttemptDto {
  id: string
  userId: string
  testId: string
  sectionId: string
  status: AttemptStatus
  startedAt: string
  submittedAt: string | null
  autoScore: number | null
  manualScore: number | null
  totalScore: number | null
  maxScore: number | null
  feedback: string | null
  createdAt: string
}

export interface AnswerDto {
  id: string
  attemptId: string
  questionId: string
  response: string | string[] | null
  audioUrl: string | null
  isCorrect: boolean | null
  awardedPoints: number | null
}

export interface SubscriptionDto {
  id: string
  plan: SubPlan
  status: SubStatus
  currentPeriodEnd: string | null
}

export interface DeviceSessionDto {
  id: string
  deviceLabel: string | null
  userAgent: string | null
  ipAddress: string | null
  lastSeenAt: string
  createdAt: string
  current: boolean
}

export interface LeaderboardRow {
  rank: number
  id: string
  name: string | null
  avatarUrl: string | null
  points: number
  streakCount: number
  currentLevel: string | null
}
