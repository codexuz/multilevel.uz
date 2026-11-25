export interface LiveMock {
  id: string
  title: string
  startsAt: string
  endsAt: string
  state: 'UPCOMING' | 'LIVE' | 'ENDED'
  test: { slug: string, title: string } | null
  skills: string[]
  /** IELTS ranks on bands, Multilevel on scores out of 75. */
  exam?: 'IELTS' | 'MULTILEVEL'
}

/**
 * The live mock open now and the next one, shared by the menu and the Tests page: of one exam (the
 * user's own when not given), or of either ('ANY').
 */
export function useLiveMock(exam?: MaybeRefOrGetter<'IELTS' | 'MULTILEVEL' | 'ANY' | null | undefined>) {
  const e = computed(() => toValue(exam) ?? undefined)
  const { data } = useFetch<{ live: LiveMock | null, next: LiveMock | null }>('/api/live', {
    key: computed(() => `live-brief-${e.value ?? 'own'}`),
    query: computed(() => ({ brief: 1, exam: e.value })),
    lazy: true,
    dedupe: 'defer'
  })
  return { live: computed(() => data.value?.live ?? null), next: computed(() => data.value?.next ?? null) }
}
