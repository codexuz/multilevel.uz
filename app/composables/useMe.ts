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
  const isStaff = computed(() => role.value === 'examiner' || role.value === 'admin')
  const isAdmin = computed(() => role.value === 'admin')
  return { me, loggedIn, role, isStaff, isAdmin, refresh, pending }
}
