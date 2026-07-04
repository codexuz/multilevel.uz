// Domain enums & types shared across the exam platform.

export type UserRole = 'student' | 'examiner' | 'admin'
export type TestStatus = 'draft' | 'published'
export type SectionType = 'listening' | 'reading' | 'writing' | 'speaking'
export type QuestionType
  = | 'single_choice'
    | 'multiple_choice'
    | 'text_input'
    | 'dropdown_match'
    | 'essay'
    | 'speaking_prompt'
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded'
export type SubPlan = 'free' | 'premium'
export type SubStatus = 'active' | 'canceled' | 'expired'

export const SECTION_TYPES: SectionType[] = ['listening', 'reading', 'writing', 'speaking']

export const SECTION_META: Record<SectionType, { label: string, icon: string, duration: number, color: string }> = {
  listening: { label: 'Listening', icon: 'i-lucide-headphones', duration: 45, color: 'info' },
  reading: { label: 'Reading', icon: 'i-lucide-book-open', duration: 60, color: 'success' },
  writing: { label: 'Writing', icon: 'i-lucide-pen-line', duration: 60, color: 'warning' },
  speaking: { label: 'Speaking', icon: 'i-lucide-mic', duration: 15, color: 'error' }
}

export const QUESTION_TYPE_META: Record<QuestionType, { label: string, sections: SectionType[] }> = {
  single_choice: { label: 'Single choice (A/B/C)', sections: ['listening', 'reading'] },
  multiple_choice: { label: 'Multiple choice', sections: ['listening', 'reading'] },
  text_input: { label: 'Gap fill (text)', sections: ['listening', 'reading'] },
  dropdown_match: { label: 'Dropdown match (A–J)', sections: ['listening', 'reading'] },
  essay: { label: 'Essay / writing task', sections: ['writing'] },
  speaking_prompt: { label: 'Speaking prompt', sections: ['speaking'] }
}

// Writing task labels & Speaking part labels
export const WRITING_TASKS = ['1.1', '1.2', '2'] as const
export const SPEAKING_PARTS = ['1.1', '1.2', '2', '3'] as const

export interface Choice {
  value: string
  label: string
}

export interface QuestionMeta {
  taskLabel?: string // writing 1.1/1.2/2 or speaking 1.1/1.2/2/3
  wordLimit?: number
  prepTime?: number // seconds
  speakTime?: number // seconds
  imageUrl?: string
}
