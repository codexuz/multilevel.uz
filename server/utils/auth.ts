import type { H3Event } from 'h3'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database.types'

export function serviceClient(event: H3Event) {
  return serverSupabaseServiceRole<Database>(event)
}

/** Ensure a signed-in user; returns the auth user. */
export async function requireUser(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  return user
}

/** Fetch a user's role using the service-role client (bypasses RLS). */
export async function getRole(event: H3Event, userId: string): Promise<string | undefined> {
  const supabase = serviceClient(event)
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return (data as { role?: string } | null)?.role
}

/** Ensure the caller is examiner or admin. Returns the auth user. */
export async function requireStaff(event: H3Event) {
  const user = await requireUser(event)
  const role = await getRole(event, user.id)
  if (role !== 'admin' && role !== 'examiner') {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return user
}
