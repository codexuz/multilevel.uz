export interface LiveMock {
  id: string
  title: string
  startsAt: string
  endsAt: string
  state: 'UPCOMING' | 'LIVE' | 'ENDED'
  test: { slug: string, title: string } | null
  skills: string[]
}

/** The live mock open now and the next one, shared by the menu and the Tests page. */
export function useLiveMock() {
  const { data } = useFetch<{ live: LiveMock | null, next: LiveMock | null }>('/api/live', { key: 'live-brief', query: { brief: 1 }, lazy: true, dedupe: 'defer' })
  return { live: computed(() => data.value?.live ?? null), next: computed(() => data.value?.next ?? null) }
}
