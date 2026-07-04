// Route middleware: gate admin/examiner pages.
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const supabase = useSupabaseClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.value.id)
    .single()

  const role = (data as { role?: string } | null)?.role
  if (role !== 'examiner' && role !== 'admin') {
    return navigateTo('/dashboard')
  }
})
