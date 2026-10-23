import type { Me } from '~/types/models'

/** Loads the current user (or null) from /api/me, cookie-aware on SSR. */
export function useMe() {
  const request = useRequestFetch()
  const { data: me, refresh, pending } = useAsyncData<Me | null>('me', async () => {
    try {
      return await request<Me>('/api/me')
    } catch (e) {
      const status = (e as { statusCode?: number, response?: { status?: number } }).statusCode
        ?? (e as { statusCode?: number, response?: { status?: number } }).response?.status
      if (status === 401) {
        try {
          await request('/api/auth/refresh', { method: 'POST' })
          return await request<Me>('/api/me')
        } catch {
          return null
        }
      }
      return null
    }
  })

  const loggedIn = computed(() => !!me.value)
  const role = computed(() => me.value?.role ?? 'student')
  // Mockmee's staff are its admins (marking and the test builder are theirs).
  const isStaff = computed(() => role.value === 'admin')
  const isAdmin = computed(() => role.value === 'admin')
  const isPremium = computed(() => !!me.value?.premium)
  const credits = computed(() => me.value?.credits ?? 0)
  const rewardCredits = computed(() => me.value?.rewardCredits ?? 0)
  /**
   * Whether a test opens for this user: free, Premium, or opened with credits or a pack; given
   * `partId` (a section item), whether that one part does, as one bought in a pack on its own.
   */
  const canOpen = (test: { id?: string, access?: string }, partId?: string | null) => test.access !== 'PREMIUM' || isPremium.value
    || (!!test.id && !!me.value?.unlockedTests?.includes(test.id))
    || (!!partId && !!me.value?.unlockedParts?.includes(partId))
  return { me, loggedIn, role, isStaff, isAdmin, isPremium, credits, rewardCredits, canOpen, refresh, pending }
}
