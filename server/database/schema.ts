import { relations } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, numeric, boolean,
  timestamp, jsonb, date, index, uniqueIndex
} from 'drizzle-orm/pg-core'

// ---------- Enums ----------
export const userRole = pgEnum('user_role', ['student', 'examiner', 'admin'])
export const testStatus = pgEnum('test_status', ['draft', 'published'])
export const sectionType = pgEnum('section_type', ['listening', 'reading', 'writing', 'speaking'])
export const questionType = pgEnum('question_type', [
  'single_choice', 'multiple_choice', 'text_input', 'dropdown_match', 'essay', 'speaking_prompt'
])
export const attemptStatus = pgEnum('attempt_status', ['in_progress', 'submitted', 'graded'])
export const subPlan = pgEnum('sub_plan', ['free', 'premium'])
export const subStatus = pgEnum('sub_status', ['active', 'canceled', 'expired'])
export const roomStatus = pgEnum('room_status', ['open', 'active', 'ended'])
export const currency = pgEnum('currency', ['points', 'coins'])
export const courseStatus = pgEnum('course_status', ['draft', 'published'])
export const lessonType = pgEnum('lesson_type', ['video', 'article', 'quiz'])
export const enrollmentStatus = pgEnum('enrollment_status', ['active', 'completed', 'canceled'])

// ---------- users ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: userRole('role').notNull().default('student'),
  banned: boolean('banned').notNull().default(false),
  // onboarding
  currentLevel: text('current_level'), // A1..C1
  learningDuration: text('learning_duration'), // '<6m' | '6-12m' | '1-2y' | '2y+'
  targetLevel: text('target_level'), // A1..C1
  targetScore: integer('target_score'), // 0..75
  onboarded: boolean('onboarded').notNull().default(false),
  // gamification
  points: integer('points').notNull().default(0),
  coins: integer('coins').notNull().default(0),
  streakCount: integer('streak_count').notNull().default(0),
  lastActivityDate: date('last_activity_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

// ---------- auth: device sessions (refresh tokens) ----------
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(), // = refresh-token sid
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  deviceLabel: text('device_label'),
  ipAddress: text('ip_address'),
  fcmToken: text('fcm_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
}, t => [index('sessions_user_idx').on(t.userId)])

// ---------- auth: access-token blacklist ----------
export const revokedTokens = pgTable('revoked_tokens', {
  jti: text('jti').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
})

// ---------- gamification ledger ----------
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currency: currency('currency').notNull(),
  delta: integer('delta').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('transactions_user_idx').on(t.userId)])

// ---------- subscriptions ----------
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plan: subPlan('plan').notNull().default('premium'),
  status: subStatus('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  provider: text('provider'),
  providerRef: text('provider_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('subscriptions_user_idx').on(t.userId)])

// ---------- tests / sections / parts / questions ----------
export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  level: text('level'),
  status: testStatus('status').notNull().default('draft'),
  isPremium: boolean('is_premium').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  type: sectionType('type').notNull(),
  title: text('title').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(45),
  orderIndex: integer('order_index').notNull().default(0),
  audioUrl: text('audio_url'),
  videoExplanationUrl: text('video_explanation_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('sections_test_idx').on(t.testId)])

export const parts = pgTable('parts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  instructions: text('instructions'),
  content: jsonb('content').notNull().default({}),
  audioUrl: text('audio_url'),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('parts_section_idx').on(t.sectionId)])

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  partId: uuid('part_id').notNull().references(() => parts.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull().default(0),
  questionNumber: integer('question_number'),
  type: questionType('type').notNull(),
  prompt: text('prompt'),
  options: jsonb('options').notNull().default([]),
  correctAnswer: jsonb('correct_answer'), // never sent to students
  points: numeric('points').notNull().default('1'),
  meta: jsonb('meta').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('questions_part_idx').on(t.partId)])

// ---------- attempts / answers ----------
export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  status: attemptStatus('status').notNull().default('in_progress'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  autoScore: numeric('auto_score'),
  manualScore: numeric('manual_score'),
  totalScore: numeric('total_score'),
  maxScore: numeric('max_score'),
  examinerId: uuid('examiner_id').references(() => users.id, { onDelete: 'set null' }),
  feedback: text('feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('attempts_user_idx').on(t.userId), index('attempts_status_idx').on(t.status)])

export const answers = pgTable('answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  response: jsonb('response'),
  audioUrl: text('audio_url'),
  isCorrect: boolean('is_correct'),
  awardedPoints: numeric('awarded_points'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, t => [
  uniqueIndex('answers_attempt_question_uq').on(t.attemptId, t.questionId),
  index('answers_attempt_idx').on(t.attemptId)
])

// ---------- speaking rooms ----------
export const speakingRooms = pgTable('speaking_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostId: uuid('host_id').references(() => users.id, { onDelete: 'set null' }),
  kind: text('kind').notNull().default('room'), // 'call' | 'random' | 'room'
  status: roomStatus('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true })
})

// ---------- LMS: courses / modules / lessons ----------
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  level: text('level'), // A1..C1
  category: text('category'), // e.g. Grammar, Vocabulary, Exam Skills
  status: courseStatus('status').notNull().default('draft'),
  isPremium: boolean('is_premium').notNull().default(false),
  estimatedMinutes: integer('estimated_minutes'),
  orderIndex: integer('order_index').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('courses_status_idx').on(t.status)])

export const courseModules = pgTable('course_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary'),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('course_modules_course_idx').on(t.courseId)])

export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => courseModules.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: lessonType('type').notNull().default('article'),
  content: text('content'), // markdown/html body for article lessons
  videoUrl: text('video_url'),
  attachments: jsonb('attachments').notNull().default([]), // [{ label, url }]
  durationMinutes: integer('duration_minutes').notNull().default(5),
  isPreview: boolean('is_preview').notNull().default(false), // viewable without enrollment
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, t => [index('lessons_module_idx').on(t.moduleId)])

// ---------- LMS: enrollments / progress ----------
export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  status: enrollmentStatus('status').notNull().default('active'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  lastLessonId: uuid('last_lesson_id').references(() => lessons.id, { onDelete: 'set null' })
}, t => [
  uniqueIndex('enrollments_user_course_uq').on(t.userId, t.courseId),
  index('enrollments_user_idx').on(t.userId)
])

export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, t => [
  uniqueIndex('lesson_progress_user_lesson_uq').on(t.userId, t.lessonId),
  index('lesson_progress_user_course_idx').on(t.userId, t.courseId)
])

// ---------- relations ----------
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  attempts: many(attempts),
  subscriptions: many(subscriptions),
  transactions: many(transactions),
  enrollments: many(enrollments)
}))
export const testsRelations = relations(tests, ({ many }) => ({ sections: many(sections) }))
export const sectionsRelations = relations(sections, ({ one, many }) => ({
  test: one(tests, { fields: [sections.testId], references: [tests.id] }),
  parts: many(parts)
}))
export const partsRelations = relations(parts, ({ one, many }) => ({
  section: one(sections, { fields: [parts.sectionId], references: [sections.id] }),
  questions: many(questions)
}))
export const questionsRelations = relations(questions, ({ one }) => ({
  part: one(parts, { fields: [questions.partId], references: [parts.id] })
}))
export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  user: one(users, { fields: [attempts.userId], references: [users.id] }),
  test: one(tests, { fields: [attempts.testId], references: [tests.id] }),
  section: one(sections, { fields: [attempts.sectionId], references: [sections.id] }),
  answers: many(answers)
}))
export const answersRelations = relations(answers, ({ one }) => ({
  attempt: one(attempts, { fields: [answers.attemptId], references: [attempts.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] })
}))
export const coursesRelations = relations(courses, ({ many }) => ({
  modules: many(courseModules),
  enrollments: many(enrollments)
}))
export const courseModulesRelations = relations(courseModules, ({ one, many }) => ({
  course: one(courses, { fields: [courseModules.courseId], references: [courses.id] }),
  lessons: many(lessons)
}))
export const lessonsRelations = relations(lessons, ({ one }) => ({
  module: one(courseModules, { fields: [lessons.moduleId], references: [courseModules.id] })
}))
export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] })
}))
export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(lessons, { fields: [lessonProgress.lessonId], references: [lessons.id] }),
  course: one(courses, { fields: [lessonProgress.courseId], references: [courses.id] })
}))
