import type { Database, Profile } from '~/types/database.types'

/**
 * Loads and caches the current user's profile (role, name, avatar).
 * Shared across the app via useState.
 */
export function useProfile() {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient<Database>()
  const profile = useState<Profile | null>('profile', () => null)
  const pending = useState<boolean>('profile-pending', () => false)

  async function refresh() {
    const uid = user.value?.id
    if (!uid) {
      profile.value = null
      return
    }
    pending.value = true
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()
    profile.value = data ?? null
    pending.value = false
  }

  // Auto-load once when a user is present and profile not yet fetched.
  if (import.meta.client) {
    watch(user, (u) => {
      if (u?.id && !profile.value) refresh()
      if (!u) profile.value = null
    }, { immediate: true })
  }

  const role = computed(() => profile.value?.role ?? 'student')
  const isStaff = computed(() => role.value === 'examiner' || role.value === 'admin')
  const isAdmin = computed(() => role.value === 'admin')

  return { profile, pending, role, isStaff, isAdmin, refresh }
}
