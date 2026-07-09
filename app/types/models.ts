// API DTO shapes (camelCase, as returned by the /api/* endpoints). These mirror the
// Drizzle schema in server/database/schema.ts but are hand-declared so the client has
// no server-only imports.
import type {
  UserRole, TestStatus, SectionType, QuestionType, AttemptStatus,
  SubPlan, SubStatus, Choice, QuestionMeta, CompletionGroup,
  CourseStatus, LessonType, EnrollmentStatus
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
  content: { passage?: string, groups?: CompletionGroup[] } & Record<string, unknown>
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

// ---------- LMS ----------
export interface LessonAttachment {
  label: string
  url: string
}

// Lesson summary — no article body.
export interface LessonSummaryDto {
  id: string
  moduleId: string
  title: string
  type: LessonType
  videoUrl: string | null
  durationMinutes: number
  isPreview: boolean
  orderIndex: number
}

// Admin lesson — includes body + attachments.
export interface AdminLessonDto extends LessonSummaryDto {
  content: string | null
  attachments: LessonAttachment[]
}

// Full lesson content (student player).
export interface LessonDto {
  id: string
  moduleId: string
  courseId: string
  title: string
  type: LessonType
  content: string | null
  videoUrl: string | null
  attachments: LessonAttachment[]
  durationMinutes: number
  isPreview: boolean
  completed: boolean
  enrolled: boolean
}

export interface CourseModuleDto<L = LessonSummaryDto> {
  id: string
  title: string
  summary: string | null
  orderIndex: number
  lessons: L[]
}

export interface CourseDto {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  level: string | null
  category: string | null
  status: CourseStatus
  isPremium: boolean
  estimatedMinutes: number | null
}

// Row shape for course list endpoints (admin + student catalog).
export interface CourseListItemDto {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  level: string | null
  category: string | null
  status?: CourseStatus
  isPremium: boolean
  estimatedMinutes?: number | null
  lessonCount: number
  enrolled?: boolean
  createdAt?: string
}

export interface EnrollmentInfoDto {
  status: EnrollmentStatus
  enrolledAt: string
  completedAt: string | null
  lastLessonId: string | null
}

// GET /api/courses/[id] — student course detail.
export interface CourseDetailDto {
  course: CourseDto
  lessonCount: number
  modules: CourseModuleDto[]
  enrollment: EnrollmentInfoDto | null
  completedLessonIds: string[]
  progress: number
}

// GET /api/admin/courses/[id] — admin course tree.
export interface AdminCourseTreeDto {
  course: CourseDto
  lessonCount: number
  modules: CourseModuleDto<AdminLessonDto>[]
}

// GET /api/me/courses — enrolled courses with progress.
export interface MyCourseDto {
  enrollmentId: string
  status: EnrollmentStatus
  enrolledAt: string
  completedAt: string | null
  lastLessonId: string | null
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  level: string | null
  category: string | null
  lessonCount: number
  completedCount: number
  progress: number
}

// Standard envelope returned by paginated list endpoints.
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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
