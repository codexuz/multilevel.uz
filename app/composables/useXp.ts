/** My XP (students): today against the daily goal, the streak, the week, the total and the level. */
export interface XpSummary {
  today: number
  goal: number
  streak: number
  extendedToday: boolean
  week: { day: string, xp: number }[]
  total: number
  level: number
  levelFrom: number
  levelTo: number
}

export function useXp() {
  const { me } = useMe()
  const student = computed(() => !!me.value && areaOf(me.value.role) === 'student')
  const request = useRequestFetch()
  const { data, refresh } = useAsyncData<XpSummary | null>('xp', () => (student.value ? request<XpSummary>('/api/me/xp') : Promise.resolve(null)), { watch: [student] })
  async function setGoal(goal: number) {
    await $fetch('/api/me/xp/goal', { method: 'PATCH', body: { goal } })
    await refresh()
  }
  return { xp: data, student, refresh, setGoal }
}

/** Fetches my XP again, after something that earns it (from anywhere). */
export const refreshXp = () => refreshNuxtData('xp')
