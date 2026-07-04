// Route middleware: admin-only pages (user role management, subscriptions).
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const supabase = useSupabaseClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.value.id)
    .single()

  if ((data as { role?: string } | null)?.role !== 'admin') {
    return navigateTo('/dashboard')
  }
})
