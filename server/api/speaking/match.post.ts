// Random peer matchmaking for the live speaking room.
// Pairs the caller with a waiting open room, or opens a new one to wait in.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const supabase = serviceClient(event)

  // Clean up any stale open room this user already owns
  await supabase.from('speaking_rooms')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('user_a', user.id).eq('status', 'open')

  // Try to join someone else's open room
  const { data: open } = await supabase
    .from('speaking_rooms')
    .select('id, user_a')
    .eq('status', 'open')
    .is('user_b', null)
    .neq('user_a', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (open) {
    const room = open as { id: string, user_a: string }
    const { error } = await supabase.from('speaking_rooms')
      .update({ user_b: user.id, status: 'active' })
      .eq('id', room.id)
      .eq('status', 'open') // guard against a race
    if (!error) {
      return { roomId: room.id, role: 'callee' as const, matched: true }
    }
  }

  // Otherwise open a new room and wait
  const { data: created, error } = await supabase
    .from('speaking_rooms')
    .insert({ user_a: user.id, status: 'open' })
    .select('id')
    .single()
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { roomId: (created as { id: string }).id, role: 'caller' as const, matched: false }
})
