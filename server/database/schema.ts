import { relations, sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, boolean, serial,
  timestamp, jsonb, index, uniqueIndex, primaryKey, type AnyPgColumn
} from 'drizzle-orm/pg-core'

// ---------- Enums ----------
export const userRole = pgEnum('user_role', ['student', 'examiner', 'admin'])

// ---------- users ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Google accounts have an email; Telegram accounts may have only a Telegram id.
  email: text('email').unique(),
  telegramId: text('telegram_id').unique(),
  telegramUsername: text('telegram_username'),
  /** Telegram messages from the bot: marking done, AI feedback ready, an invite paid off. */
  telegramNotify: boolean('telegram_notify').notNull().default(true),
  /** Pressed Start in the bot (and has not blocked it since): the bot can always write to them. */
  telegramBotJoined: boolean('telegram_bot_joined').notNull().default(false),
  // referrals: the code in this user's invite link, and who invited them
  referralCode: text('referral_code').unique(),
  referredById: uuid('referred_by_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
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

// ---------- tests ----------
// The same structure as the erp-lms IELTS addon (IeltsTest … IeltsQuestionItem), without the
// centre, so a test file moves between the two unchanged. Values are upper case, as there:
// status DRAFT | PUBLISHED, skill LISTENING | READING | WRITING | SPEAKING.

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())

export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The address of the test's public page, /tests/<slug>. */
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  mode: text('mode').notNull().default('PRACTICE'), // PRACTICE | MOCK
  status: text('status').notNull().default('DRAFT'),
  category: text('category'), // AUTHENTIC | CAMBRIDGE | PRE_TEST | CUSTOM
  module: text('module').notNull().default('MULTILEVEL'),
  source: text('source'),
  /** FREE: anyone can sit it. PREMIUM: its page is public, sitting it needs an active plan. */
  access: text('access').notNull().default('FREE'),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('tests_status_idx').on(t.status)])

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  skill: text('skill').notNull(),
  position: integer('position').notNull().default(1),
  title: text('title'),
  instructions: text('instructions'),
  durationSeconds: integer('duration_seconds'),
  /** Listening: the full recording, played through the whole section. */
  audioRef: text('audio_ref'),
  settings: jsonb('settings').notNull().default({}),
  createdAt: created(),
  updatedAt: updated()
}, t => [uniqueIndex('sections_test_skill_uq').on(t.testId, t.skill)])

export const parts = pgTable('parts', {
  id: uuid('id').primaryKey().defaultRandom(),
  skill: text('skill').notNull(), // LISTENING | READING
  partNumber: integer('part_number').notNull(),
  title: text('title'),
  passage: text('passage'),
  audioRef: text('audio_ref'),
  transcriptRef: text('transcript_ref'),
  difficulty: text('difficulty'),
  timeLimitMinutes: integer('time_limit_minutes'),
  isActive: boolean('is_active').notNull().default(true),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
  updatedAt: updated()
})

export const questionGroups = pgTable('question_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  partId: uuid('part_id').notNull().references(() => parts.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  /** One of the task types in server/utils/answers.ts (NOTE_COMPLETION, MATCHING_HEADINGS …). */
  type: text('type').notNull(),
  instruction: text('instruction'),
  /** Shared text with the gaps in it (notes, drag-and-drop summary), as HTML. */
  context: text('context'),
  /** { options: [{key, text}], headings: [{key, text}], table: {headers, rows}, image, lead }. */
  content: jsonb('content').notNull().default({}),
  explanation: text('explanation'),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('question_groups_part_idx').on(t.partId, t.position)])

export const questionItems = pgTable('question_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => questionGroups.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  position: integer('position').notNull().default(1),
  prompt: text('prompt'),
  /** Never sent before the answers are in. */
  acceptedAnswers: text('accepted_answers').array().notNull().default([]),
  explanation: text('explanation'),
  evidence: text('evidence'),
  points: integer('points').notNull().default(1),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('question_items_group_idx').on(t.groupId)])

export const writingTasks = pgTable('writing_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Multilevel: 1 = Task 1.1, 2 = Task 1.2, 3 = Task 2 (the title says which). */
  taskNumber: integer('task_number').notNull(),
  module: text('module'),
  title: text('title'),
  prompt: text('prompt').notNull(),
  imageRef: text('image_ref'),
  minWords: integer('min_words'),
  suggestedMinutes: integer('suggested_minutes'),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
  updatedAt: updated()
})

export const speakingParts = pgTable('speaking_parts', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Multilevel: 1 = Part 1.1, 2 = Part 1.2, 3 = Part 2, 4 = Part 3 (the title says which). */
  partNumber: integer('part_number').notNull(),
  title: text('title'),
  cueCard: text('cue_card'),
  /** Multilevel picture tasks (Part 1.2, Part 2). */
  imageRef: text('image_ref'),
  prepSeconds: integer('prep_seconds'),
  speakSeconds: integer('speak_seconds'),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
  updatedAt: updated()
})

export const speakingQuestions = pgTable('speaking_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  partId: uuid('part_id').notNull().references(() => speakingParts.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  position: integer('position').notNull().default(1),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('speaking_questions_part_idx').on(t.partId)])

export const sectionItems = pgTable('section_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  partId: uuid('part_id').references(() => parts.id, { onDelete: 'cascade' }),
  writingTaskId: uuid('writing_task_id').references(() => writingTasks.id, { onDelete: 'cascade' }),
  speakingPartId: uuid('speaking_part_id').references(() => speakingParts.id, { onDelete: 'cascade' }),
  createdAt: created()
}, t => [index('section_items_section_idx').on(t.sectionId, t.position)])

// ---------- attempts (signed-in users only; a guest's answers are checked and never stored) ----------
export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  testId: uuid('test_id').references(() => tests.id, { onDelete: 'set null' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  /** The skill this attempt was (one section at a time). */
  skill: text('skill').notNull(),
  /** Set when one part was practised on its own (Listening/Reading part, Writing task, Speaking part). */
  partNumber: integer('part_number'),
  mode: text('mode').notNull().default('PRACTICE'),
  status: text('status').notNull().default('SUBMITTED'), // SUBMITTED (awaiting an examiner) | GRADED
  startedAt: timestamp('started_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  /** Listening and Reading: right answers out of the questions. */
  correct: integer('correct'),
  total: integer('total'),
  /** The Multilevel scaled score, 0–75, and its CEFR level. */
  score: integer('score'),
  cefrLevel: text('cefr_level'),
  examinerId: uuid('examiner_id').references(() => users.id, { onDelete: 'set null' }),
  feedback: text('feedback'),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('attempts_user_idx').on(t.userId, t.submittedAt), index('attempts_status_idx').on(t.status)])

export const answers = pgTable('answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => questionItems.id, { onDelete: 'cascade' }),
  response: text('response'),
  isCorrect: boolean('is_correct'),
  createdAt: created()
}, t => [uniqueIndex('answers_attempt_item_uq').on(t.attemptId, t.itemId)])

export const essays = pgTable('essays', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => writingTasks.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  wordCount: integer('word_count').notNull().default(0),
  feedback: text('feedback'),
  createdAt: created(),
  updatedAt: updated()
}, t => [uniqueIndex('essays_attempt_task_uq').on(t.attemptId, t.taskId)])

export const speakingResponses = pgTable('speaking_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  partId: uuid('part_id').notNull().references(() => speakingParts.id, { onDelete: 'cascade' }),
  audioRef: text('audio_ref').notNull(),
  durationSeconds: integer('duration_seconds'),
  createdAt: created()
}, t => [uniqueIndex('speaking_responses_attempt_part_uq').on(t.attemptId, t.partId)])

// ---------- relations ----------
// ---------- Billing ----------
// What is sold: time with Premium (the whole library and every explanation) and marking credits
// (one Writing or Speaking section marked by an examiner). A plan can carry both.

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  /** In so'm. */
  priceUzs: integer('price_uzs').notNull(),
  /** Days of Premium it gives (0 for a pack of credits only). */
  durationDays: integer('duration_days').notNull().default(0),
  /** Marking credits it gives. */
  credits: integer('credits').notNull().default(0),
  /** Shown as the one to choose. */
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  position: integer('position').notNull().default(1),
  createdAt: created(),
  updatedAt: updated()
})

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The order's number: Click's merchant_trans_id and merchant_prepare_id. */
  number: serial('number').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  /** The plan as it was sold, so later price changes do not rewrite history. */
  planName: text('plan_name').notNull(),
  amountUzs: integer('amount_uzs').notNull(),
  durationDays: integer('duration_days').notNull().default(0),
  credits: integer('credits').notNull().default(0),
  /** click | manual (sold privately, granted by an admin) */
  provider: text('provider').notNull(),
  status: text('status').notNull().default('PENDING'), // PENDING | PAID | CANCELLED
  clickTransId: text('click_trans_id'),
  clickPaydocId: text('click_paydoc_id'),
  note: text('note'),
  grantedById: uuid('granted_by_id').references(() => users.id, { onDelete: 'set null' }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('orders_user_idx').on(t.userId, t.createdAt), index('orders_status_idx').on(t.status)])

/** A stretch of Premium. Buying while one runs starts the next where it ends. */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  createdAt: created()
}, t => [index('subscriptions_user_idx').on(t.userId, t.endsAt)])

/** Marking credits in and out; the balance is their sum. */
export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(), // PURCHASE | GRANT | MARKING | REFUND
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  attemptId: uuid('attempt_id').references(() => attempts.id, { onDelete: 'set null' }),
  createdAt: created()
}, t => [index('credit_transactions_user_idx').on(t.userId)])

// ---------- rewards: credits that open premium tests ----------
// Earned by inviting friends and joining the Telegram channel, spent to open a premium test for
// good. Separate from the marking credits above, which buy an examiner's time.
export const rewardTransactions = pgTable('reward_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(), // REFERRAL | WELCOME | TELEGRAM_CHANNEL | UNLOCK | GRANT
  /** REFERRAL: the friend whose first test earned it. */
  referredUserId: uuid('referred_user_id').references(() => users.id, { onDelete: 'set null' }),
  /** UNLOCK: the test it opened. */
  testId: uuid('test_id').references(() => tests.id, { onDelete: 'set null' }),
  createdAt: created()
}, t => [
  index('reward_transactions_user_idx').on(t.userId),
  // Each friend earns their inviter once; the welcome and the channel are once per user.
  uniqueIndex('reward_transactions_referral_uq').on(t.referredUserId).where(sql`reason = 'REFERRAL'`),
  uniqueIndex('reward_transactions_once_uq').on(t.userId, t.reason).where(sql`reason in ('WELCOME', 'TELEGRAM_CHANNEL')`)
])

// ---------- AI feedback on Writing ----------
// An instant estimate while (or instead of) waiting for an examiner: a score out of 75, each
// task's criteria, and corrections. Made from a saved attempt or from essays written in practice.
export const aiReviews = pgTable('ai_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** The saved attempt it is for; null for practice that was not handed in. */
  attemptId: uuid('attempt_id').references(() => attempts.id, { onDelete: 'cascade' }).unique(),
  testId: uuid('test_id').references(() => tests.id, { onDelete: 'set null' }),
  skill: text('skill').notNull().default('WRITING'),
  status: text('status').notNull().default('PENDING'), // PENDING | DONE | FAILED
  /** What was assessed: each task's prompt and the candidate's text. */
  input: jsonb('input').notNull(),
  result: jsonb('result'),
  score: integer('score'),
  cefrLevel: text('cefr_level'),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  error: text('error'),
  createdAt: created(),
  completedAt: timestamp('completed_at', { withTimezone: true })
}, t => [index('ai_reviews_user_idx').on(t.userId, t.createdAt)])

/** Premium tests a user opened with credits: theirs for good. */
export const testUnlocks = pgTable('test_unlocks', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  createdAt: created()
}, t => [primaryKey({ columns: [t.userId, t.testId] })])

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  attempts: many(attempts)
}))
export const testsRelations = relations(tests, ({ many }) => ({ sections: many(sections) }))
export const sectionsRelations = relations(sections, ({ one, many }) => ({
  test: one(tests, { fields: [sections.testId], references: [tests.id] }),
  items: many(sectionItems)
}))
export const sectionItemsRelations = relations(sectionItems, ({ one }) => ({
  section: one(sections, { fields: [sectionItems.sectionId], references: [sections.id] }),
  part: one(parts, { fields: [sectionItems.partId], references: [parts.id] }),
  writingTask: one(writingTasks, { fields: [sectionItems.writingTaskId], references: [writingTasks.id] }),
  speakingPart: one(speakingParts, { fields: [sectionItems.speakingPartId], references: [speakingParts.id] })
}))
export const partsRelations = relations(parts, ({ many }) => ({ groups: many(questionGroups) }))
export const questionGroupsRelations = relations(questionGroups, ({ one, many }) => ({
  part: one(parts, { fields: [questionGroups.partId], references: [parts.id] }),
  items: many(questionItems)
}))
export const questionItemsRelations = relations(questionItems, ({ one }) => ({
  group: one(questionGroups, { fields: [questionItems.groupId], references: [questionGroups.id] })
}))
export const speakingPartsRelations = relations(speakingParts, ({ many }) => ({ questions: many(speakingQuestions) }))
export const speakingQuestionsRelations = relations(speakingQuestions, ({ one }) => ({
  part: one(speakingParts, { fields: [speakingQuestions.partId], references: [speakingParts.id] })
}))
export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  user: one(users, { fields: [attempts.userId], references: [users.id] }),
  test: one(tests, { fields: [attempts.testId], references: [tests.id] }),
  section: one(sections, { fields: [attempts.sectionId], references: [sections.id] }),
  answers: many(answers),
  essays: many(essays),
  speaking: many(speakingResponses)
}))
export const answersRelations = relations(answers, ({ one }) => ({
  attempt: one(attempts, { fields: [answers.attemptId], references: [attempts.id] }),
  item: one(questionItems, { fields: [answers.itemId], references: [questionItems.id] })
}))
export const essaysRelations = relations(essays, ({ one }) => ({
  attempt: one(attempts, { fields: [essays.attemptId], references: [attempts.id] }),
  task: one(writingTasks, { fields: [essays.taskId], references: [writingTasks.id] })
}))
export const speakingResponsesRelations = relations(speakingResponses, ({ one }) => ({
  attempt: one(attempts, { fields: [speakingResponses.attemptId], references: [attempts.id] }),
  part: one(speakingParts, { fields: [speakingResponses.partId], references: [speakingParts.id] })
}))

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  plan: one(plans, { fields: [orders.planId], references: [plans.id] })
}))
