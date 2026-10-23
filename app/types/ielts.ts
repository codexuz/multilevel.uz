// Test types: the same shapes as the erp-lms IELTS API (this app mirrors it), and the render shapes the
// question components draw from. Multilevel numbers writing tasks 1–3 (Task 1.1, 1.2, 2) and speaking
// parts 1–4 (Part 1.1, 1.2, 2, 3).

export type IELTSQuestionType
  = | 'NOTE_COMPLETION'
    | 'TRUE_FALSE_NOT_GIVEN'
    | 'YES_NO_NOT_GIVEN'
    | 'MATCHING_INFORMATION'
    | 'MATCHING_HEADINGS'
    | 'SUMMARY_COMPLETION'
    | 'SUMMARY_COMPLETION_DRAG_DROP'
    | 'MULTIPLE_CHOICE'
    | 'SENTENCE_COMPLETION'
    | 'SHORT_ANSWER'
    | 'TABLE_COMPLETION'
    | 'FLOW_CHART_COMPLETION'
    | 'DIAGRAM_LABELLING'
    | 'MATCHING_FEATURES'
    | 'MATCHING_SENTENCE_ENDINGS'
    | 'PLAN_MAP_LABELLING'
    | 'MULTIPLE_ANSWER'

export type Skill = 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type TestMode = 'PRACTICE' | 'MOCK'
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type IeltsModule = 'ACADEMIC' | 'GENERAL_TRAINING' | 'MULTILEVEL'
export type AttemptScope = 'TEST' | 'SECTION' | 'PART' | 'TASK'
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'ABANDONED'

export interface Paged<T> { items: T[], total: number, page: number, limit: number, pages: number }

// ─── Content as the API returns it ────────────────────────────────────────

export interface QuestionItem {
  id: string
  number: number
  position?: number
  prompt?: string | null
  /** Staff and reviews only. */
  acceptedAnswers?: string[]
  explanation?: string | null
  evidence?: string | null
  points?: number
  /** Reviews only. */
  answer?: string | null
  isCorrect?: boolean
}

export interface GroupContent {
  options?: { key: string, text: string }[]
  headings?: { key: string, text: string }[]
  table?: { headers: string[], rows: string[][] }
  image?: string
  imageUrl?: string | null
  /** A short line shown above the group (the old "context"). */
  lead?: string
}

export interface QuestionGroup {
  id: string
  partId?: string
  position: number
  type: IELTSQuestionType
  instruction?: string | null
  /** The shared text with the gaps in it, as HTML. */
  context?: string | null
  content: GroupContent
  explanation?: string | null
  from: number | null
  to: number | null
  items: QuestionItem[]
}

export interface Part {
  id: string
  exam?: string | null
  skill: 'LISTENING' | 'READING'
  partNumber: number
  title?: string | null
  passage?: string | null
  audioRef?: string | null
  audioUrl?: string | null
  transcriptRef?: string | null
  transcriptUrl?: string | null
  difficulty?: Difficulty | null
  timeLimitMinutes?: number | null
  isActive?: boolean
  groups?: QuestionGroup[]
  questionCount?: number
  from?: number | null
  to?: number | null
  types?: string[]
  excerpt?: string | null
  tests?: { id: string, title: string, status: TestStatus }[]
  answered?: number
  lastAttempt?: AttemptBrief | null
  updatedAt?: string
}

export interface WritingTask {
  id: string
  /** IELTS | MULTILEVEL: how the task is numbered and how long it should be. */
  exam?: string | null
  taskNumber: number
  module?: IeltsModule | null
  title?: string | null
  prompt: string
  imageRef?: string | null
  imageUrl?: string | null
  minWords?: number | null
  suggestedMinutes?: number | null
  essays?: number
  /** How many tests it is placed in (library lists). */
  inTests?: number
  /** The tests it is placed in (library lists). */
  tests?: { id: string, title: string, status: TestStatus }[]
  lastAttempt?: AttemptBrief | null
}

export interface SpeakingPart {
  id: string
  exam?: string | null
  partNumber: number
  title?: string | null
  cueCard?: string | null
  imageRef?: string | null
  imageUrl?: string | null
  /** The examiner's audio for a long turn (the card or statement), when the test has its own. */
  audioRef?: string | null
  audioUrl?: string | null
  /** A model answer to the long turn: the builder and a review only. */
  sampleAnswer?: string | null
  /** How many tests it is placed in (library lists). */
  inTests?: number
  /** The tests it is placed in (library lists). */
  tests?: { id: string, title: string, status: TestStatus }[]
  prepSeconds?: number | null
  speakSeconds?: number | null
  questions: SpeakingQuestion[]
}

export interface SpeakingQuestion {
  id: string
  text: string
  position: number
  /** The examiner asking it, when the test has its own audio. */
  audioRef?: string | null
  audioUrl?: string | null
  /** A model answer: the builder and a review only. */
  sampleAnswer?: string | null
}

export interface SectionItem {
  id: string
  position: number
  part: Part | null
  writingTask: WritingTask | null
  speakingPart: SpeakingPart | null
}

export interface Section {
  id: string
  skill: Skill
  position: number
  title?: string | null
  instructions?: string | null
  durationSeconds?: number | null
  officialSeconds: number
  audioRef?: string | null
  audioUrl?: string | null
  settings?: Record<string, unknown>
  items: SectionItem[]
}

export interface Test {
  id: string
  slug?: string
  title: string
  description?: string | null
  mode: TestMode
  access?: 'FREE' | 'PREMIUM'
  status: TestStatus
  category?: string | null
  module: IeltsModule
  source?: string | null
  courseId?: string | null
  course?: { id: string, name: string } | null
  publishedAt?: string | null
  createdAt?: string
  updatedAt?: string
  sections: Section[]
  attempts?: number
  readiness?: { errors: string[], warnings: string[] }
}

export interface TestSummary {
  id: string
  slug?: string
  title: string
  description?: string | null
  mode: TestMode
  access?: 'FREE' | 'PREMIUM'
  status?: TestStatus
  category?: string | null
  module: IeltsModule
  /** IELTS | MULTILEVEL, from the module. */
  exam?: 'IELTS' | 'MULTILEVEL'
  source?: string | null
  publishedAt?: string | null
  updatedAt?: string
  sections: { skill: Skill, items: number, durationSeconds?: number | null }[]
  attempts?: number
  mocks?: number
  lastAttempt?: AttemptBrief | null
}

// ─── Attempts ─────────────────────────────────────────────────────────────

export interface AttemptBrief { id: string, scope: AttemptScope, status: AttemptStatus, submittedAt?: string | null, band: number | null }

export interface Bands { listening: number | null, reading: number | null, writing: number | null, speaking: number | null, overall: number | null }

export interface AttemptSummary {
  id: string
  scope: AttemptScope
  skill: Skill | null
  mode: TestMode
  /** When the Listening recording first started (a mock plays it once). */
  audioStartedAt?: string | null
  status: AttemptStatus
  title: string | null
  test: { id: string, title: string, mode: TestMode, module: IeltsModule } | null
  part: { id: string, skill: Skill, partNumber: number, title: string | null } | null
  writingTask: { id: string, taskNumber: number, title: string | null } | null
  mock: { id: string, title: string } | null
  user?: { id: string, name: string, phone?: string, avatarUrl?: string | null }
  studentId?: string | null
  startedAt: string
  deadlineAt: string | null
  submittedAt: string | null
  gradedAt: string | null
  durationSeconds: number | null
  listening: { correct: number, total: number } | null
  reading: { correct: number, total: number } | null
  bands: Bands
  band: number | null
  essays: { id: string, taskId: string, marked: boolean, aiStatus: string | null, band: number | null }[]
}

export interface PaperSection {
  skill: Skill
  /** IELTS sits on the computer-delivered IELTS screen; Multilevel on Mockmee's own. */
  exam?: 'IELTS' | 'MULTILEVEL'
  title: string | null
  instructions: string | null
  seconds: number
  audioUrl: string | null
  parts: Part[]
  tasks: (WritingTask & { minWords: number })[]
}

export interface ReviewEssay {
  id: string
  text: string
  wordCount: number
  criteria: { taskResponse: number, coherence: number, lexical: number, grammar: number } | null
  band: number | null
  feedback: string | null
  gradedAt: string | null
  gradedBy: { id: string, name: string } | null
  aiStatus: string | null
  aiError?: string | null
}

export interface ReviewSection {
  skill: Skill
  /** IELTS | MULTILEVEL: how tasks and parts are numbered and marked. */
  exam?: string | null
  title: string | null
  audioUrl: string | null
  correct: number | null
  total: number | null
  band: number | null
  estimated: boolean
  parts: Part[]
  tasks: { task: WritingTask & { minWords: number }, essay: ReviewEssay | null }[]
}

export interface AttemptView extends Omit<AttemptSummary, 'essays'> {
  serverNow: string
  remainingSeconds: number | null
  module: IeltsModule
  paper?: { module: IeltsModule, sections: PaperSection[] }
  answers?: Record<string, string>
  essays?: any
  review?: { sections: ReviewSection[] } | null
  /** A mock result kept back until it is announced: handed in, nothing more to show. */
  held?: boolean
  /** Which endpoint it came through (set by the client): a teacher's results or one's own attempts. */
  source?: 'teaching' | 'study'
}

// ─── Mocks ────────────────────────────────────────────────────────────────

export interface MockSectionState {
  unlocked: boolean
  status: 'NOT_STARTED' | AttemptStatus
  attemptId: string | null
  band: number | null
  correct?: number | null
  total?: number | null
  deadlineAt?: string | null
  toMark?: boolean
}

export interface MyMock {
  candidateId: string
  mock: {
    id: string
    title: string
    opensAt: string | null
    closesAt: string | null
    group: { id: string, name: string } | null
    test: { id: string, title: string, module: IeltsModule }
    introVideos: Partial<Record<Skill, string | null>>
  }
  window: 'UPCOMING' | 'OPEN' | 'CLOSED'
  sections: Partial<Record<Skill, MockSectionState>>
  overall: number | null
  /** Bands are kept back until the mock's results are announced. */
  held?: boolean
}

/** The candidate seated at a mock-room computer. */
export interface MySeat extends MyMock {
  name: string
  external: boolean
  speaking: boolean
  finished: boolean
}

export interface SeatSession {
  accessToken: string
  refreshToken: string
  expiresIn: number
  /** seatKey goes with this seat's answers kept on the computer, so they can be sent after a crash. */
  seat: { candidateId: string, mockId: string, external: boolean, name: string, seatKey: string }
}

/** An announced mock result, as the report link shows it. */
export interface MockReport {
  center: { name: string }
  candidate: { name: string }
  mock: { title: string, date: string | null, releasedAt: string }
  test: { title: string, module: IeltsModule }
  overall: number | null
  sections: Partial<Record<Skill, {
    band: number | null
    correct?: number | null
    total?: number | null
    tasks?: { taskNumber: number, band: number | null, criteria: Record<string, number> | null }[]
    criteria?: Record<string, number> | null
  }>>
}

export interface MockCandidate {
  id: string
  userId: string
  studentId: string | null
  name: string
  phone: string | null
  avatarUrl: string | null
  unlockedSkills: Skill[]
  sections: Partial<Record<Skill, MockSectionState>>
  overall: number | null
  /** Someone from outside, registered at reception. */
  external?: boolean
  documentNo?: string | null
  leadId?: string | null
  payment?: { amount: number | null, method: PaymentMethod, at: string } | null
  checkedInAt?: string | null
  /** The seat code, until it is used. */
  seatCode?: string | null
  seatedAt?: string | null
  releasedAt?: string | null
  reportToken?: string | null
  ready?: boolean
  missing?: Skill[]
  /** The test they sit: the mock's own, or another of the session's. */
  test?: { id: string, title: string, module: IeltsModule }
  /** Their test's sections, in the order sat. */
  skills?: Skill[]
}

/** What the mock page counts over every candidate. */
export interface MockSummary {
  total: number
  sitting: number
  toMark: number
  finished: number
  external: number
  checkedIn: number
  cash: number
  card: number
  announced: number
  ready: number
  stillMarking: number
  skills: Partial<Record<Skill, { open: number, sitting: number }>>
}

/** One of a session's tests, with its sections and how many candidates sit it. */
export interface MockTest {
  id: string
  title: string
  module: IeltsModule
  skills: Skill[]
  candidates: number
}

export interface MockAssignment {
  id: string
  title: string
  testId: string
  groupId: string | null
  opensAt: string | null
  closesAt: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  test: { id: string, title: string, module: IeltsModule }
  /** Tests sat in the same session beside `test`. */
  extraTestIds?: string[]
  /** Every test of the session, the mock's own first (the mock page). */
  tests?: MockTest[]
  /** The mock page: its counts over every candidate (`candidates` is one page of them). */
  summary?: MockSummary
  candidatePage?: { page: number, limit: number, total: number, pages: number }
  /** Students in the mock already, on any page. */
  studentIds?: string[]
  group: { id: string, name: string } | null
  assignedBy?: { id: string, name: string } | null
  candidates: number | MockCandidate[]
  sectionsDone?: number
  skills?: Skill[]
  introVideos?: Partial<Record<Skill, string | null>>
  createdAt: string
  /** Bands kept from candidates until announced. */
  holdResults?: boolean
  /** A mock-centre session: seats, room and fee. */
  capacity?: number | null
  room?: string | null
  price?: number | null
}

// ─── Render shapes (the question components' contract) ──────────────────

export interface IELTSQuestionOption {
  id?: string
  optionKey: string
  optionText: string
  isCorrect: boolean
  orderIndex: number
  explanation?: string
  fromPassage?: string
}

export interface IELTSSubQuestion {
  id?: string
  questionNumber?: number
  questionText?: string
  points?: number
  correctAnswer?: string
  explanation?: string
  fromPassage?: string
  order?: number
}

export interface IELTSQuestion {
  id?: string
  questionNumber?: number
  type?: IELTSQuestionType
  questionText?: string
  instruction?: string
  context?: string
  headingOptions?: Record<string, string>
  tableData?: { headers: string[], rows: string[][] }
  points?: number
  explanation?: string
  fromPassage?: string
  questions?: IELTSSubQuestion[]
  options?: IELTSQuestionOption[]
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

/** A CRM lead offered for registration on the mock page, with a mock fee they paid ahead, if any. */
export interface MockLead {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  pipeline: { code: string | null, name: string } | null
  stage: string | null
  /** Already a candidate in this session. */
  registered: boolean
  payment: { id: string, amount: number | null, method: PaymentMethod, paidAt: string, forThisMock: boolean } | null
}

/** A student offered for a mock (GET /ielts/mock-students). */
export interface MockStudentHit {
  id: string
  name: string
  phone: string | null
  studentNumber: string
  groups: string[]
  /** Has an account to sit the mock with. */
  canSignIn: boolean
  /** Already a candidate in the session asked about. */
  inMock: boolean
}
