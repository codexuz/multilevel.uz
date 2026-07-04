// Hand-maintained Supabase schema types. Keep in sync with
// supabase/migrations/0001_init.sql. (Regenerate with `supabase gen types` if you
// wire up the CLI.)
//
// NOTE: these are `type` aliases (not interfaces) on purpose — supabase-js requires
// each Row to be assignable to Record<string, unknown>, which interfaces are not.
import type {
  UserRole, TestStatus, SectionType, QuestionType,
  AttemptStatus, SubPlan, SubStatus
} from './exam'

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export type Subscription = {
  id: string
  user_id: string
  plan: SubPlan
  status: SubStatus
  current_period_end: string | null
  provider: string | null
  provider_ref: string | null
  created_at: string
  updated_at: string
}

export type Test = {
  id: string
  title: string
  description: string | null
  level: string | null
  status: TestStatus
  is_premium: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Section = {
  id: string
  test_id: string
  type: SectionType
  title: string
  duration_minutes: number
  order_index: number
  audio_url: string | null
  created_at: string
}

export type Part = {
  id: string
  section_id: string
  title: string
  instructions: string | null
  content: Json
  audio_url: string | null
  order_index: number
  created_at: string
}

export type Question = {
  id: string
  part_id: string
  order_index: number
  question_number: number | null
  type: QuestionType
  prompt: string | null
  options: Json
  correct_answer: Json
  points: number
  meta: Json
  created_at: string
}

export type Attempt = {
  id: string
  user_id: string
  test_id: string
  section_id: string
  status: AttemptStatus
  started_at: string
  submitted_at: string | null
  auto_score: number | null
  manual_score: number | null
  total_score: number | null
  max_score: number | null
  examiner_id: string | null
  feedback: string | null
  created_at: string
}

export type Answer = {
  id: string
  attempt_id: string
  question_id: string
  response: Json
  audio_url: string | null
  is_correct: boolean | null
  awarded_points: number | null
  updated_at: string
}

export type SpeakingQueueRow = {
  user_id: string
  status: string
  room_id: string | null
  created_at: string
}

export type SpeakingRoomRow = {
  id: string
  user_a: string
  user_b: string | null
  status: string
  created_at: string
  ended_at: string | null
}

type TableDef<R> = { Row: R, Insert: Partial<R>, Update: Partial<R>, Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>
      subscriptions: TableDef<Subscription>
      tests: TableDef<Test>
      sections: TableDef<Section>
      parts: TableDef<Part>
      questions: TableDef<Question>
      attempts: TableDef<Attempt>
      answers: TableDef<Answer>
      speaking_queue: TableDef<SpeakingQueueRow>
      speaking_rooms: TableDef<SpeakingRoomRow>
    }
    Views: {
      student_questions: { Row: Omit<Question, 'correct_answer'>, Relationships: [] }
    }
    Functions: {
      has_active_premium: { Args: { uid: string }, Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
