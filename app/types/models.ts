// API DTO shapes for accounts and admin lists (camelCase, as returned by /api/*). The test
// shapes, shared with the erp-lms IELTS app, are in ./ielts.ts.

export type UserRole = 'student' | 'examiner' | 'admin'

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
  email: string
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
