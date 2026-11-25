import type { LiveLesson } from '~/components/online/Row.vue'

/** A group I am in, as the list shows it. */
export interface MyGroup {
  id: string
  name: string
  exam: string
  level: string | null
  description: string | null
  joinedAt: string
  teacher: { name: string, avatarUrl: string | null }
  members: number
  decks: number
  todo: number
  done: number
  overdue: number
  nextClass: LiveLesson | null
}

/** My groups (shared by the dashboard and My groups). */
export function useMyGroups() {
  return useFetch<{ groups: MyGroup[] }>('/api/me/groups', { key: 'my-groups', default: () => ({ groups: [] }) })
}
