import { relations, sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, boolean, serial,
  timestamp, date, jsonb, real, index, uniqueIndex, primaryKey, type AnyPgColumn
} from 'drizzle-orm/pg-core'

// ---------- Enums ----------
/** student; teacher (has classes, runs mock sessions); admin. center_owner is no longer given (learning centres were removed). */
export const userRole = pgEnum('user_role', ['student', 'teacher', 'center_owner', 'admin'])

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
  /** The interface language they chose (en, uz, ru): the bot writes to them in it. */
  locale: text('locale'),
  /** Extra AI reviews an admin gave, used after the regular allowance runs out. */
  aiBonusReviews: integer('ai_bonus_reviews').notNull().default(0),
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
  /** The exam they prepare for (IELTS | MULTILEVEL): the catalogue opens on it. */
  exam: text('exam'),
  /** IELTS: the overall band they aim for. */
  targetBand: real('target_band'),
  /** The day of the user's real exam (Tashkent date): a countdown, a weekly plan and reminders. */
  examDate: date('exam_date', { mode: 'string' }),
  /** The last day the bot sent a study plan reminder, so it writes at most once a day. */
  planRemindedOn: date('plan_reminded_on', { mode: 'string' }),
  onboarded: boolean('onboarded').notNull().default(false),
  /** XP a day the student aims for (10 casual, 30 regular, 50 serious, 100 intense). */
  dailyGoal: integer('daily_goal').notNull().default(30),
  /** Made for a walk-in candidate of a mock session: it signs in only at their seat (mock-sessions.ts). */
  mockOnly: boolean('mock_only').notNull().default(false),
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
  /** The exam and its kind: MULTILEVEL, or ACADEMIC | GENERAL_TRAINING for IELTS (examOfModule). */
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
  /** IELTS | MULTILEVEL: the exam whose tests it goes into (its numbering follows that exam). */
  exam: text('exam').notNull().default('MULTILEVEL'),
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
  exam: text('exam').notNull().default('MULTILEVEL'),
  /** Multilevel: 1 = Task 1.1, 2 = Task 1.2, 3 = Task 2. IELTS: 1 = Task 1, 2 = Task 2. */
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
  exam: text('exam').notNull().default('MULTILEVEL'),
  /** Multilevel: 1 = Part 1.1, 2 = Part 1.2, 3 = Part 2, 4 = Part 3. IELTS: Part 1, 2 and 3. */
  partNumber: integer('part_number').notNull(),
  title: text('title'),
  cueCard: text('cue_card'),
  /** Multilevel picture tasks (Part 1.2, Part 2). */
  imageRef: text('image_ref'),
  /** The examiner reading the card or statement (a long turn), recorded or imported; none: generated once. */
  audioRef: text('audio_ref'),
  /** A model answer to the long turn, shown after the attempt; the AI review uses it instead of writing one. */
  sampleAnswer: text('sample_answer'),
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
  /** The examiner asking it, recorded or imported; none: generated once (examiner-voice.ts). */
  audioRef: text('audio_ref'),
  /** A model answer, shown after the attempt; the AI review uses it instead of writing one. */
  sampleAnswer: text('sample_answer'),
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

// ---------- live mocks ----------
// A test everyone sits in the same window (a weekend, say), ranked on one leaderboard. A draft test
// stays hidden until the window opens and joins the library when it closes.
export const liveMocks = pgTable('live_mocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  /** When the bot told everyone it started, and when it told each participant their place. */
  announcedAt: timestamp('announced_at', { withTimezone: true }),
  resultsSentAt: timestamp('results_sent_at', { withTimezone: true }),
  /** The Telegram channels it is posted to (telegram_channels ids, or 'default' for TELEGRAM_CHANNEL); null: those of its exam. */
  channelIds: text('channel_ids').array(),
  /** IELTS | MULTILEVEL: its test's exam. Mocks of one exam never overlap; the two exams run side by side. */
  exam: text('exam').notNull().default('MULTILEVEL'),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created()
}, t => [index('live_mocks_window_idx').on(t.startsAt, t.endsAt)])

// The Telegram channels the bot posts live mocks to, besides TELEGRAM_CHANNEL: one an exam (or both),
// each in its own language. The bot must be an admin of each that can post messages.
export const telegramChannels = pgTable('telegram_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** @username or the numeric id (-100…). */
  chat: text('chat').notNull().unique(),
  title: text('title').notNull(),
  url: text('url'),
  /** IELTS | MULTILEVEL; null: both. */
  exam: text('exam'),
  locale: text('locale').notNull().default('uz'),
  createdAt: created()
})

// ---------- broadcasts: news and updates the bot sends users (admins) ----------
export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The message in each language written ({ uz, ru, en }); each user gets theirs, else the first written. */
  texts: jsonb('texts').notNull().default({}),
  imageUrl: text('image_url'),
  buttonText: text('button_text'),
  buttonUrl: text('button_url'),
  /** Who it goes to: { role: ALL | STUDENTS | TEACHERS, exam: ANY | IELTS | MULTILEVEL, locale: ANY | uz | ru | en }. */
  audience: jsonb('audience').notNull().default({}),
  /** Telegram channels it was also posted to (telegram_channels ids, or 'default'). */
  channelIds: text('channel_ids').array(),
  /** SENDING | DONE */
  status: text('status').notNull().default('SENDING'),
  total: integer('total').notNull().default(0),
  sent: integer('sent').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
  finishedAt: timestamp('finished_at', { withTimezone: true })
}, t => [index('broadcasts_created_idx').on(t.createdAt)])

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
  status: text('status').notNull().default('SUBMITTED'), // SUBMITTED (waiting for the student's teacher) | SAVED (Writing or Speaking with nobody to mark it: the AI check only, until sent to a teacher) | GRADED
  startedAt: timestamp('started_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  /** Listening and Reading: right answers out of the questions. */
  correct: integer('correct'),
  total: integer('total'),
  /** The exam it was (IELTS | MULTILEVEL), so results read on the right scale. */
  exam: text('exam').notNull().default('MULTILEVEL'),
  /** Multilevel: the scaled score, 0–75. IELTS: the band, 0–9 in halves. And the CEFR level. */
  score: integer('score'),
  band: real('band'),
  cefrLevel: text('cefr_level'),
  examinerId: uuid('examiner_id').references(() => users.id, { onDelete: 'set null' }),
  feedback: text('feedback'),
  /** Set on a user's first whole section of each skill sat during a live mock: it counts there. */
  liveMockId: uuid('live_mock_id').references(() => liveMocks.id, { onDelete: 'set null' }),
  /** What the exam page saw while it was sat (away from the page, full screen left, pasting): see integrity.ts. */
  integrity: jsonb('integrity'),
  /** Why it looks wrong (AWAY, PASTE, FAST, PARALLEL, DEVICES); null when nothing did. */
  integrityFlags: text('integrity_flags').array(),
  /** FLAGGED (to look at) | CLEARED | WARNED | DISQUALIFIED (off a live mock's board); null: nothing to look at. */
  integrityStatus: text('integrity_status'),
  integrityNote: text('integrity_note'),
  integrityReviewedAt: timestamp('integrity_reviewed_at', { withTimezone: true }),
  integrityReviewedById: uuid('integrity_reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
  /** Sat at a mock session's seat: whose seat it was. */
  mockCandidateId: uuid('mock_candidate_id').references((): AnyPgColumn => mockCandidates.id, { onDelete: 'set null' }),
  /** When the candidate's teachers were reminded that this script still waits for a mark. */
  markRemindedAt: timestamp('mark_reminded_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('attempts_integrity_idx').on(t.integrityStatus, t.submittedAt),
  index('attempts_user_idx').on(t.userId, t.submittedAt), index('attempts_status_idx').on(t.status), index('attempts_submitted_idx').on(t.submittedAt),
  uniqueIndex('attempts_live_mock_uq').on(t.liveMockId, t.userId, t.skill).where(sql`${t.liveMockId} is not null`)
])

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
  /** When the writer chose to show it, unnamed, as a sample on the task's public page; null: not shown. */
  sharedAt: timestamp('shared_at', { withTimezone: true }),
  /** When an admin took it off the public page (it stays the writer's). */
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [uniqueIndex('essays_attempt_task_uq').on(t.attemptId, t.taskId), index('essays_shared_idx').on(t.taskId, t.sharedAt)])

/**
 * One recorded answer: Part 1.1 and 1.2 are answered question by question (`position` is the
 * question's place in the part, from 0), Part 2 and Part 3 in one turn (position 0).
 */
export const speakingResponses = pgTable('speaking_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  partId: uuid('part_id').notNull().references(() => speakingParts.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  audioRef: text('audio_ref').notNull(),
  durationSeconds: integer('duration_seconds'),
  createdAt: created()
}, t => [uniqueIndex('speaking_responses_attempt_part_position_uq').on(t.attemptId, t.partId, t.position)])

// ---------- teachers' classes ----------
/**
 * A teacher's class: students join it with its code (/join/<code>); the teacher sets it work
 * (assignments), sees each student's results and marks their Writing and Speaking. Classes are free,
 * with no limit on students.
 */
export const classGroups = pgTable('class_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Group exam track: IELTS | MULTILEVEL (CEFR). Assignments filter tests by this exam. */
  exam: text('exam').notNull().default('MULTILEVEL'),
  /** Optional level/exam label shown on Teacher Panel cards (e.g. A2, B1, B2, C1, IELTS). */
  level: text('level'),
  description: text('description'),
  /** The teacher it belongs to: they made it, and their classes go with their account. */
  teacherId: uuid('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Students join with /join/<code>. */
  joinCode: text('join_code').notNull().unique(),
  archived: boolean('archived').notNull().default(false),
  createdAt: created()
}, t => [index('class_groups_teacher_idx').on(t.teacherId)])

export const classMembers = pgTable('class_members', {
  groupId: uuid('group_id').notNull().references(() => classGroups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow()
}, t => [primaryKey({ columns: [t.groupId, t.userId] }), index('class_members_user_idx').on(t.userId)])

/** A section of a test (or one part of it) a group is asked to sit; done once a member hands it in after it was set. */
export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => classGroups.id, { onDelete: 'cascade' }),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  skill: text('skill').notNull(),
  partNumber: integer('part_number'),
  note: text('note'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  /** When the students who had not handed it in were reminded that it is due soon (once). */
  dueRemindedAt: timestamp('due_reminded_at', { withTimezone: true }),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created()
}, t => [index('assignments_group_idx').on(t.groupId, t.createdAt)])

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
  /** A test pack bought: its tests open for good when the order is paid. */
  packId: uuid('pack_id').references((): AnyPgColumn => packs.id, { onDelete: 'set null' }),
  /** A promo code taken off the price (amountUzs is what is paid, after it). */
  promoCodeId: uuid('promo_code_id').references((): AnyPgColumn => promoCodes.id, { onDelete: 'set null' }),
  discountUzs: integer('discount_uzs').notNull().default(0),
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
  /** Told in Telegram that it is about to end, and that it has ended (once each). */
  remindedBeforeAt: timestamp('reminded_before_at', { withTimezone: true }),
  remindedAfterAt: timestamp('reminded_after_at', { withTimezone: true }),
  createdAt: created()
}, t => [index('subscriptions_user_idx').on(t.userId, t.endsAt)])

// ---------- promo codes ----------
/**
 * A code that takes a percentage or an amount off a plan, or gives days of Premium by itself.
 * Each user can use a code once; a code can be limited to some plans, a number of uses and a date.
 */
export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Stored in capitals; typed in any case. */
  code: text('code').notNull().unique(),
  kind: text('kind').notNull(), // PERCENT | AMOUNT | DAYS
  /** Percent off (1–100), so'm off, or days of Premium. */
  value: integer('value').notNull(),
  /** Plan codes it applies to; empty for every plan (PERCENT and AMOUNT). */
  planCodes: jsonb('plan_codes').$type<string[]>().notNull().default([]),
  maxUses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  note: text('note'),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created()
})

export const promoRedemptions = pgTable('promo_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  promoCodeId: uuid('promo_code_id').notNull().references(() => promoCodes.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  createdAt: created()
}, t => [uniqueIndex('promo_redemptions_once_uq').on(t.promoCodeId, t.userId)])

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
  /** The language the comments are written in (en, uz, ru); corrections stay in English. */
  locale: text('locale'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** The saved attempt it is for; null for practice that was not handed in. */
  attemptId: uuid('attempt_id').references(() => attempts.id, { onDelete: 'cascade' }).unique(),
  testId: uuid('test_id').references(() => tests.id, { onDelete: 'set null' }),
  skill: text('skill').notNull().default('WRITING'),
  status: text('status').notNull().default('PENDING'), // PENDING | DONE | FAILED
  /** Came with a paid marking or was asked for by an examiner: not counted in the user's allowance. */
  free: boolean('free').notNull().default(false),
  /** What was assessed: each task's prompt and the candidate's text. */
  input: jsonb('input').notNull(),
  result: jsonb('result'),
  score: integer('score'),
  /** IELTS: the band the AI gave. */
  band: real('band'),
  cefrLevel: text('cefr_level'),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  error: text('error'),
  createdAt: created(),
  completedAt: timestamp('completed_at', { withTimezone: true })
}, t => [index('ai_reviews_user_idx').on(t.userId, t.createdAt)])

// ---------- test packs ----------
/**
 * A bundle of tests sold once (say, ten authentic IELTS Academic tests): paying opens each of them
 * for good, as an unlocked test, whatever happens to Premium.
 */
export const packs = pgTable('packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  exam: text('exam').notNull().default('IELTS'),
  /** In so'm; `oldPriceUzs` is shown struck through beside it. */
  priceUzs: integer('price_uzs').notNull(),
  oldPriceUzs: integer('old_price_uzs'),
  coverUrl: text('cover_url'),
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  position: integer('position').notNull().default(1),
  createdAt: created(),
  updatedAt: updated()
})

export const packTests = pgTable('pack_tests', {
  packId: uuid('pack_id').notNull().references(() => packs.id, { onDelete: 'cascade' }),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1)
}, t => [primaryKey({ columns: [t.packId, t.testId] }), index('pack_tests_test_idx').on(t.testId)])

// Single parts in a pack (a Reading passage, a Writing task), beside its whole tests.
export const packParts = pgTable('pack_parts', {
  packId: uuid('pack_id').notNull().references(() => packs.id, { onDelete: 'cascade' }),
  sectionItemId: uuid('section_item_id').notNull().references(() => sectionItems.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1)
}, t => [primaryKey({ columns: [t.packId, t.sectionItemId] }), index('pack_parts_item_idx').on(t.sectionItemId)])

/** Single parts of premium tests a user bought in a pack: theirs for good, the rest of the test not. */
export const partUnlocks = pgTable('part_unlocks', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sectionItemId: uuid('section_item_id').notNull().references(() => sectionItems.id, { onDelete: 'cascade' }),
  createdAt: created()
}, t => [primaryKey({ columns: [t.userId, t.sectionItemId] })])

// ---------- Mock sessions: a teacher runs a mock on their own computers ----------
// Candidates (its students, or walk-ins registered at the desk) are checked in by the invigilator,
// who gives each a seat code; the code signs them in at a room computer for that session only.
// The invigilator opens sections for the room, watches the board, marks Writing and Speaking, and
// announces the results as a report page. See server/utils/mock-sessions.ts.

export const mockSessions = pgTable('mock_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The teacher who runs it. */
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'restrict' }),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  room: text('room'),
  capacity: integer('capacity'),
  /** The fee a walk-in pays at the desk, in so'm (shown on the board; collected by the teacher). */
  priceUzs: integer('price_uzs'),
  /** Bands are kept from candidates until announced. */
  holdResults: boolean('hold_results').notNull().default(true),
  /** ACTIVE | ARCHIVED */
  status: text('status').notNull().default('ACTIVE'),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('mock_sessions_owner_idx').on(t.ownerId, t.opensAt)])

export const mockCandidates = pgTable('mock_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => mockSessions.id, { onDelete: 'cascade' }),
  /** The account they sit as: their own (a student of the teacher's classes) or one made for a walk-in (users.mock_only). */
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  external: boolean('external').notNull().default(false),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  documentNo: text('document_no'),
  /** Paid at the desk: so'm, CASH or CARD, when. */
  paidUzs: integer('paid_uzs'),
  paymentMethod: text('payment_method'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  /** Identity seen; the seat code then lets them in, once, while the session runs. */
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  seatCode: text('seat_code'),
  seatedAt: timestamp('seated_at', { withTimezone: true }),
  /** The sign-in the seat code made, ended when they leave the seat or are checked in again. */
  seatSessionId: uuid('seat_session_id'),
  /** Sections the invigilator opened for them (LISTENING, READING, WRITING). */
  unlockedSkills: text('unlocked_skills').array().notNull().default([]),
  /** What their exam page reports as it goes: the section open on screen, and what it saw (integrity.ts). */
  live: jsonb('live'),
  /** Marks given on the board: Writing (over the AI's estimate) and Speaking (held face to face). */
  marks: jsonb('marks').notNull().default({}),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  reportToken: text('report_token').unique(),
  createdAt: created()
}, t => [uniqueIndex('mock_candidates_session_user_uq').on(t.sessionId, t.userId), index('mock_candidates_code_idx').on(t.seatCode)])

/** Mock credits: one is spent when a candidate is first checked in. A teacher's. */
export const mockCreditTransactions = pgTable('mock_credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  /** GRANT (bought) | CHECK_IN | REFUND (a candidate removed before sitting) */
  reason: text('reason').notNull(),
  candidateId: uuid('candidate_id').references(() => mockCandidates.id, { onDelete: 'set null' }),
  note: text('note'),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created()
}, t => [index('mock_credit_user_idx').on(t.userId)])

// ---------- Google: a teacher's Calendar, for Meet links ----------
/**
 * A teacher's Google account connected for Calendar (google-calendar.ts): Mockmee makes a Calendar
 * event with a Google Meet link for each online class. The tokens are kept encrypted.
 */
export const googleConnections = pgTable('google_connections', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  googleEmail: text('google_email'),
  /** Encrypted (AES-GCM): lets Mockmee act for them until they take the access back. */
  refreshToken: text('refresh_token').notNull(),
  /** Encrypted; short-lived, renewed from the refresh token. */
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  scope: text('scope'),
  createdAt: created(),
  updatedAt: updated()
})

// ---------- online classes (Google Meet) ----------
/**
 * An online class at a set time, held on Google Meet: for one of the teacher's classes, or as a
 * lesson of one of their courses. Its Meet link is made with the teacher's Google Calendar.
 */
export const liveLessons = pgTable('live_lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => classGroups.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').references((): AnyPgColumn => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  meetUrl: text('meet_url'),
  calendarEventId: text('calendar_event_id'),
  calendarLink: text('calendar_link'),
  /** SCHEDULED | CANCELLED */
  status: text('status').notNull().default('SCHEDULED'),
  /** When its students were reminded it starts soon. */
  remindedAt: timestamp('reminded_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [
  index('live_lessons_teacher_idx').on(t.teacherId, t.startsAt),
  index('live_lessons_group_idx').on(t.groupId, t.startsAt),
  index('live_lessons_course_idx').on(t.courseId, t.startsAt)
])

// ---------- courses (LMS: Course => Units/Modules => Lessons => Exercises => Questions) ----------
/**
 * A teacher's course: units/modules containing ordered lessons, interactive exercises, videos,
 * handouts, exam tasks, and Google Meet classes. Supports content drip:
 * - ALWAYS_OPEN: all modules and lessons open immediately
 * - DATE_RANGE: controlled by availableFrom / availableTo timestamps at course, module, or lesson level
 * - SEQUENTIAL: learners unlock each lesson automatically after completing the previous one
 */
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  /** A line or two for the catalogue. */
  summary: text('summary'),
  coverUrl: text('cover_url'),
  /** The course's page: a longer description (sanitized rich text) and an intro video (YouTube/Vimeo). */
  description: text('description'),
  introVideoUrl: text('intro_video_url'),
  /** Lists on the course's page: what learners will learn, what they need first, and who it is for. */
  outcomes: jsonb('outcomes').$type<string[]>().notNull().default([]),
  requirements: jsonb('requirements').$type<string[]>().notNull().default([]),
  audience: jsonb('audience').$type<string[]>().notNull().default([]),
  /** IELTS | MULTILEVEL, or null for general English. */
  exam: text('exam'),
  /** A1..C2, the level it is for (optional). */
  level: text('level'),
  /** PRIVATE | PUBLIC */
  visibility: text('visibility').notNull().default('PRIVATE'),
  published: boolean('published').notNull().default(false),
  /** Content drip mode: ALWAYS_OPEN | DATE_RANGE | SEQUENTIAL. */
  dripMode: text('drip_mode').notNull().default('ALWAYS_OPEN'),
  dripStartAt: timestamp('drip_start_at', { withTimezone: true }),
  dripEndAt: timestamp('drip_end_at', { withTimezone: true }),
  /** Default passing percentage for exercises in this course. */
  passingScore: integer('passing_score').notNull().default(70),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('courses_teacher_idx').on(t.teacherId), index('courses_public_idx').on(t.visibility, t.published)])

/** A unit/module inside a course grouping ordered lessons, with optional content-drip overrides. */
export const courseModules = pgTable('course_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  title: text('title').notNull(),
  description: text('description'),
  /** Optional drip override: null inherits course dripMode, or ALWAYS_OPEN | DATE_RANGE | SEQUENTIAL. */
  dripMode: text('drip_mode'),
  availableFrom: timestamp('available_from', { withTimezone: true }),
  availableTo: timestamp('available_to', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('course_modules_course_idx').on(t.courseId, t.position)])

/** A lesson of a course/unit: text, video, interactive exercises, exam task, PDFs, and Google Meet class. */
export const courseLessons = pgTable('course_lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').references(() => courseModules.id, { onDelete: 'set null' }),
  position: integer('position').notNull().default(1),
  title: text('title').notNull(),
  summary: text('summary'),
  durationMinutes: integer('duration_minutes'),
  /** Sanitized rich text. */
  body: text('body'),
  videoUrl: text('video_url'),
  /** A listening: an uploaded file (courses/ key) or an http(s) address, played with the waveform player. */
  audioUrl: text('audio_url'),
  /** The practice: a section of a test (or one part), done when a student hands it in. */
  taskTestId: uuid('task_test_id').references(() => tests.id, { onDelete: 'set null' }),
  taskSkill: text('task_skill'),
  taskPartNumber: integer('task_part_number'),
  /** PDFs to download: [{ name, url, size }]. */
  files: jsonb('files').notNull().default([]),
  liveLessonId: uuid('live_lesson_id').references(() => liveLessons.id, { onDelete: 'set null' }),
  /** Optional content drip date window for this lesson. */
  availableFrom: timestamp('available_from', { withTimezone: true }),
  availableTo: timestamp('available_to', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [
  index('course_lessons_course_idx').on(t.courseId, t.position),
  index('course_lessons_module_idx').on(t.moduleId, t.position)
])

/** An interactive exercise inside a lesson (Practice, Quiz, or Homework). */
export const lessonExercises = pgTable('lesson_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id').notNull().references(() => courseLessons.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  title: text('title').notNull(),
  instructions: text('instructions'),
  /** PRACTICE | QUIZ | HOMEWORK */
  exerciseType: text('exercise_type').notNull().default('PRACTICE'),
  passingScore: integer('passing_score').notNull().default(70),
  timeLimitSeconds: integer('time_limit_seconds'),
  maxAttempts: integer('max_attempts'),
  shuffleQuestions: boolean('shuffle_questions').notNull().default(false),
  /** IMMEDIATE | AFTER_SUBMIT */
  showFeedback: text('show_feedback').notNull().default('AFTER_SUBMIT'),
  requiredForCompletion: boolean('required_for_completion').notNull().default(false),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('lesson_exercises_lesson_idx').on(t.lessonId, t.position)])

/**
 * A question inside an LMS exercise. Supported types:
 * SENTENCE_BUILD | ERROR_SPOT | MCQ | SINGLE_CHOICE | SHORT_ANSWER | NOTE_COMPLETION |
 * SUMMARY_COMPLETION | SUMMARY_DRAG_DROP | TRUE_FALSE | ORDER | TRANSLATION | DICTATION | WRITTEN_RESPONSE
 */
export const exerciseQuestions = pgTable('exercise_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  exerciseId: uuid('exercise_id').notNull().references(() => lessonExercises.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  type: text('type').notNull(),
  prompt: text('prompt').notNull().default(''),
  /** Context passage/notes/summary with {{1}} gaps, or target sentence for ERROR_SPOT. */
  context: text('context'),
  audioRef: text('audio_ref'),
  imageRef: text('image_ref'),
  /** Type-specific structured config (options, words, distractors, segments, items, wordBank, ttsText, etc.). */
  config: jsonb('config').notNull().default({}),
  /** Accepted answer key(s): string[] or Record<string, string[]> for multi-blank questions. */
  acceptedAnswers: jsonb('accepted_answers').notNull().default([]),
  explanation: text('explanation'),
  points: integer('points').notNull().default(1),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('exercise_questions_exercise_idx').on(t.exerciseId, t.position)])

/** A student's graded attempt at a lesson exercise. */
export const exerciseAttempts = pgTable('exercise_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  exerciseId: uuid('exercise_id').notNull().references(() => lessonExercises.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull().default({}),
  results: jsonb('results').notNull().default({}),
  /** Percentage 0..100 */
  score: integer('score').notNull().default(0),
  /**
   * Written responses in it: AI (marked by the AI, the teacher may look again), PENDING (waiting for
   * the teacher: the AI could not mark), TEACHER (the teacher marked them); null when it has none.
   */
  reviewStatus: text('review_status'),
  earnedPoints: integer('earned_points').notNull().default(0),
  totalPoints: integer('total_points').notNull().default(0),
  passed: boolean('passed').notNull().default(false),
  durationSeconds: integer('duration_seconds'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: created()
}, t => [
  index('exercise_attempts_user_idx').on(t.userId, t.submittedAt),
  index('exercise_attempts_exercise_idx').on(t.exerciseId, t.userId)
])

/** Who took a public course (a private one's students are the teacher's class students). */
export const courseEnrollments = pgTable('course_enrollments', {
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  enrolledAt: created()
}, t => [primaryKey({ columns: [t.courseId, t.userId] }), index('course_enrollments_user_idx').on(t.userId)])

/** A lesson a student marked done. */
export const lessonProgress = pgTable('lesson_progress', {
  lessonId: uuid('lesson_id').notNull().references(() => courseLessons.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  completedAt: created()
}, t => [primaryKey({ columns: [t.lessonId, t.userId] }), index('lesson_progress_user_idx').on(t.userId)])

// ---------- answer explanations: 10 results a day ----------
/**
 * The marked Listening and Reading results whose explanations a user has opened: up to 10 new ones a
 * day (Tashkent time), and once opened, a result's explanations stay open (explanations.ts).
 */
export const explanationOpens = pgTable('explanation_opens', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  /** The Tashkent day it was opened, which it counts toward. */
  openedOn: date('opened_on', { mode: 'string' }).notNull(),
  createdAt: created()
}, t => [primaryKey({ columns: [t.userId, t.attemptId] }), index('explanation_opens_day_idx').on(t.userId, t.openedOn)])

// ---------- vocabulary: My Words ----------
/**
 * What a word or phrase means, written once by the AI for each interface language and shared by
 * everyone who saves it (words.ts): the second student to save "mitigate" costs nothing.
 */
export const wordCache = pgTable('word_cache', {
  /** The words as saved, normalised (lower case, single spaces, no punctuation around them). */
  term: text('term').notNull(),
  /** The language the translation is in (en, uz, ru); en has none. */
  locale: text('locale').notNull(),
  /** The dictionary form ("mitigated" → "mitigate"). */
  lemma: text('lemma').notNull(),
  partOfSpeech: text('part_of_speech'),
  /** A plain English definition, for a learner. */
  definition: text('definition').notNull(),
  translation: text('translation'),
  /** A1..C2. */
  cefr: text('cefr'),
  createdAt: created()
}, t => [primaryKey({ columns: [t.term, t.locale] })])

/**
 * A word or phrase a student picked out of a text to learn, with the sentence it came from and its
 * place in their review schedule (a Leitner box: the higher the box, the longer until it comes back).
 */
export const userWords = pgTable('user_words', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** As the student selected it. */
  word: text('word').notNull(),
  /** Normalised, as in word_cache: one entry per word for each student. */
  term: text('term').notNull(),
  lemma: text('lemma'),
  /** The sentence of the text it was picked from. */
  sentence: text('sentence'),
  /** The Reading or Listening part it came from. */
  partId: uuid('part_id').references(() => parts.id, { onDelete: 'set null' }),
  // Copied from word_cache when it is defined, so the student's own copy can be changed later.
  partOfSpeech: text('part_of_speech'),
  definition: text('definition'),
  translation: text('translation'),
  cefr: text('cefr'),
  /** Review schedule: box 0 (new) to 5, when it is next due, and how it has gone. */
  box: integer('box').notNull().default(0),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
  reviews: integer('reviews').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [
  uniqueIndex('user_words_user_term_uq').on(t.userId, t.term),
  index('user_words_due_idx').on(t.userId, t.dueAt),
  index('user_words_created_idx').on(t.userId, t.createdAt)
])

/** Premium tests a user opened with credits or bought in a pack: theirs for good. */
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

// ---------- XP: what a learner earns (tests, lessons, quizzes, words), for streaks and goals ----------
/**
 * One award of XP. `refKey` names what it was for when it may be earned once only ("lesson:{id}",
 * "attempt:{id}", "quiz:{id}"); practice that may be repeated has none. A day of a streak is a day
 * (in Tashkent) with any XP.
 */
export const xpEvents = pgTable('xp_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** test | lesson | quiz | words | deck */
  source: text('source').notNull(),
  amount: integer('amount').notNull(),
  refKey: text('ref_key'),
  createdAt: created()
}, t => [
  uniqueIndex('xp_events_user_ref_uq').on(t.userId, t.refKey).where(sql`ref_key is not null`),
  index('xp_events_user_time_idx').on(t.userId, t.createdAt)
])

// ---------- vocabulary decks: a teacher's word sets, by category and topic, studied by classes ----------
/** A teacher's deck of words (e.g. category "IELTS", topic "Environment", level B2). */
export const vocabDecks = pgTable('vocab_decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category'),
  topic: text('topic'),
  /** A1..C2 */
  level: text('level'),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('vocab_decks_teacher_idx').on(t.teacherId)])

/** A card of a deck: the word, what it means, an example, and its Uzbek and Russian. */
export const vocabCards = pgTable('vocab_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull().references(() => vocabDecks.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  term: text('term').notNull(),
  partOfSpeech: text('part_of_speech'),
  ipa: text('ipa'),
  definition: text('definition').notNull(),
  example: text('example'),
  translationUz: text('translation_uz'),
  translationRu: text('translation_ru'),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('vocab_cards_deck_idx').on(t.deckId, t.position)])

/** A deck set to a class: its students study it. */
export const vocabDeckGroups = pgTable('vocab_deck_groups', {
  deckId: uuid('deck_id').notNull().references(() => vocabDecks.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => classGroups.id, { onDelete: 'cascade' }),
  assignedAt: created()
}, t => [primaryKey({ columns: [t.deckId, t.groupId] }), index('vocab_deck_groups_group_idx').on(t.groupId)])

/** How a student is doing with a card: its box (0 new … 5 known), when it is due, and the tally. */
export const vocabProgress = pgTable('vocab_progress', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => vocabCards.id, { onDelete: 'cascade' }),
  box: integer('box').notNull().default(0),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
  correct: integer('correct').notNull().default(0),
  wrong: integer('wrong').notNull().default(0),
  lastAt: timestamp('last_at', { withTimezone: true }).notNull().defaultNow()
}, t => [primaryKey({ columns: [t.userId, t.cardId] }), index('vocab_progress_user_idx').on(t.userId, t.dueAt)])

// ---------- course speaking studio: prompts, voice answers, peer assessments & comments ----------
/** A speaking prompt added by a course teacher for enrolled students to record voice answers. */
export const courseSpeakingQuestions = pgTable('course_speaking_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  tips: text('tips'),
  /** Optional part / category label (e.g. Part 1, Part 2, Part 3, Discussion). */
  partLabel: text('part_label'),
  /** Suggested speaking duration in seconds (optional). */
  suggestedSeconds: integer('suggested_seconds'),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('course_speaking_questions_course_idx').on(t.courseId, t.position)])

/** A voice recording submitted by an enrolled student (or teacher) answering a speaking studio question. */
export const courseSpeakingRecordings = pgTable('course_speaking_recordings', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => courseSpeakingQuestions.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  audioUrl: text('audio_url').notNull(),
  durationSeconds: integer('duration_seconds'),
  note: text('note'),
  createdAt: created(),
  updatedAt: updated()
}, t => [
  index('course_speaking_rec_question_idx').on(t.questionId, t.createdAt),
  index('course_speaking_rec_course_idx').on(t.courseId, t.createdAt),
  index('course_speaking_rec_user_idx').on(t.userId, t.createdAt)
])

/** Peer/teacher structured assessment (1–5) on a speaking studio recording; one per reviewer per recording. */
export const courseSpeakingAssessments = pgTable('course_speaking_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id').notNull().references(() => courseSpeakingRecordings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Overall rating 1..5 */
  overall: integer('overall').notNull(),
  /** Optional IELTS/CEFR speaking criteria 1..5 */
  fluency: integer('fluency'),
  vocabulary: integer('vocabulary'),
  grammar: integer('grammar'),
  pronunciation: integer('pronunciation'),
  createdAt: created(),
  updatedAt: updated()
}, t => [
  uniqueIndex('course_speaking_assess_rec_user_uq').on(t.recordingId, t.userId),
  index('course_speaking_assess_rec_idx').on(t.recordingId)
])

/** Comments / peer feedback left on a speaking studio recording. */
export const courseSpeakingComments = pgTable('course_speaking_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id').notNull().references(() => courseSpeakingRecordings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: created(),
  updatedAt: updated()
}, t => [index('course_speaking_comments_rec_idx').on(t.recordingId, t.createdAt)])

// ---------- Support: user bug reports, feature requests, and general feedback ----------
export const supportFeedback = pgTable('support_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  /** bug | feedback | feature | question */
  kind: text('kind').notNull().default('feedback'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  pageUrl: text('page_url'),
  contact: text('contact'),
  /** open | in_progress | resolved | closed */
  status: text('status').notNull().default('open'),
  adminNote: text('admin_note'),
  resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated()
}, t => [
  index('support_feedback_user_idx').on(t.userId, t.createdAt),
  index('support_feedback_status_idx').on(t.status, t.createdAt)
])
