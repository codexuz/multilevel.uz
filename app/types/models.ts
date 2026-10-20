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
  name: string | null
  avatarUrl: string | null
  role: UserRole
  currentLevel: string | null
  learningDuration: string | null
  targetLevel: string | null
  targetScore: number | null
  onboarded: boolean
  /** Premium now (staff always): every test and every explanation. */
  premium: boolean
  premiumUntil: string | null
  /** Writing or Speaking markings left. */
  credits: number
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
