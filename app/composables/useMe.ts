import type { Me } from '~/types/models'

/** Loads the current user (or null) from /api/me, cookie-aware on SSR. */
export function useMe() {
  const request = useRequestFetch()
  const { data: me, refresh, pending } = useAsyncData<Me | null>('me', async () => {
    try {
      return await request<Me>('/api/me')
    } catch {
      return null
    }
  })

  const loggedIn = computed(() => !!me.value)
  const role = computed(() => me.value?.role ?? 'student')
  const isStaff = computed(() => role.value === 'examiner' || role.value === 'admin')
  const isAdmin = computed(() => role.value === 'admin')
  const isPremium = computed(() => !!me.value?.isPremium)

  return { me, loggedIn, role, isStaff, isAdmin, isPremium, refresh, pending }
}
