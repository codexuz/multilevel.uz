import type { Database, Subscription } from '~/types/database.types'

/** Loads the current user's active premium subscription status. */
export function useSubscription() {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient<Database>()

  const { data: subscription, refresh, pending } = useAsyncData<Subscription | null>(
    'subscription',
    async () => {
      if (!user.value) return null
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.value.id)
        .eq('plan', 'premium')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    { watch: [user] }
  )

  const isPremium = computed(() => {
    const s = subscription.value
    if (!s) return false
    if (!s.current_period_end) return true
    return new Date(s.current_period_end) > new Date()
  })

  return { subscription, isPremium, refresh, pending }
}
