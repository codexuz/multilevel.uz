// Creates (or resumes) an attempt for a section. Enforces premium gating
// server-side so a locked test can never be started by tampering with the client.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { sectionId } = await readBody<{ sectionId: string }>(event)
  if (!sectionId) throw createError({ statusCode: 400, message: 'sectionId required' })

  const supabase = serviceClient(event)

  // Section + test
  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('id, test_id, tests(id, status, is_premium)')
    .eq('id', sectionId)
    .single()
  if (sectionError) throw createError({ statusCode: 500, message: `Section lookup failed: ${sectionError.message}` })
  if (!section) throw createError({ statusCode: 404, message: 'Section not found' })

  const test = (section as unknown as { test_id: string, tests: { status: string, is_premium: boolean } }).tests
  if (test.status !== 'published') throw createError({ statusCode: 403, message: 'Test not available' })

  if (test.is_premium) {
    const { data: premium } = await supabase.rpc('has_active_premium', { uid: user.id })
    if (!premium) throw createError({ statusCode: 402, message: 'Premium subscription required' })
  }

  // Resume an in-progress attempt if one exists
  const { data: existing } = await supabase
    .from('attempts')
    .select('id')
    .eq('user_id', user.id)
    .eq('section_id', sectionId)
    .eq('status', 'in_progress')
    .maybeSingle()
  if (existing) return { attemptId: (existing as { id: string }).id, resumed: true }

  // Compute max score from question points in the section
  const { data: questions } = await supabase
    .from('questions')
    .select('points, parts!inner(section_id)')
    .eq('parts.section_id', sectionId)
  const maxScore = ((questions as unknown as { points: number }[]) ?? []).reduce((s, q) => s + Number(q.points || 0), 0)

  const { data: attempt, error } = await supabase
    .from('attempts')
    .insert({
      user_id: user.id,
      test_id: (section as unknown as { test_id: string }).test_id,
      section_id: sectionId,
      status: 'in_progress',
      max_score: maxScore
    })
    .select('id')
    .single()
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { attemptId: (attempt as { id: string }).id, resumed: false }
})
