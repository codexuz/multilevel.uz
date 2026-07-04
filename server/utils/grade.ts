import type { Json } from '~/types/database.types'

/** Grade a single objective question. Returns true when the response is correct. */
export function gradeQuestion(
  type: string,
  correct: Json,
  response: Json
): boolean {
  switch (type) {
    case 'single_choice':
    case 'dropdown_match': {
      return typeof response === 'string'
        && typeof correct === 'string'
        && response.trim() === correct.trim()
    }
    case 'text_input': {
      const accepted = (Array.isArray(correct) ? correct : [correct])
        .filter((v): v is string => typeof v === 'string')
        .map(v => v.trim().toLowerCase())
      const given = typeof response === 'string' ? response.trim().toLowerCase() : ''
      return given.length > 0 && accepted.includes(given)
    }
    case 'multiple_choice': {
      if (!Array.isArray(correct) || !Array.isArray(response)) return false
      const c = [...correct].map(String).sort()
      const r = [...response].map(String).sort()
      return c.length === r.length && c.every((v, i) => v === r[i])
    }
    default:
      return false
  }
}
