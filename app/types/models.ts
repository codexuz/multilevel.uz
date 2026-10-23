// API DTO shapes for accounts and admin lists (camelCase, as returned by /api/*). The test
// shapes, shared with the erp-lms IELTS app, are in ./ielts.ts.

export type UserRole = 'student' | 'examiner' | 'admin'

export interface Me {
  id: string
  /** Null for an account made with Telegram. */
  email: string | null
  telegramUsername: string | null
  /** Telegram is linked: the account can sign in with it. */
  telegram: boolean
  /** Messages from the bot (marking done, AI feedback ready, invites). */
  telegramNotify: boolean
  /** Has pressed Start in the bot. */
  telegramBot: boolean
  name: string | null
  avatarUrl: string | null
  role: UserRole
  currentLevel: string | null
  learningDuration: string | null
  targetLevel: string | null
  targetScore: number | null
  /** The exam they prepare for, or null before they chose. */
  exam: 'IELTS' | 'MULTILEVEL' | null
  /** IELTS: the overall band they aim for. */
  targetBand: number | null
  onboarded: boolean
  /** Premium now (staff always): every test and every explanation. */
  premium: boolean
  premiumUntil: string | null
  /** Writing or Speaking markings left. */
  credits: number
  /** Credits earned (invites, the Telegram channel) that open premium tests. */
  rewardCredits: number
  /** Credits one premium test takes to open. */
  unlockCost: number
  /** Premium tests opened with credits. */
  unlockedTests: string[]
  mockOnly?: boolean
  runsMocks?: boolean
  /** Single parts (section items) bought in packs. */
  unlockedParts?: string[]
  /** Learning centres I belong to, and my role in each. */
  centres?: { id: string, name: string, role: 'OWNER' | 'TEACHER' | 'STUDENT' }[]
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

export interface AdminUserDto {
  id: string
  name: string | null
  email: string | null
  telegramUsername: string | null
  telegram: boolean
  avatarUrl: string | null
  role: UserRole
  banned: boolean
  createdAt: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
