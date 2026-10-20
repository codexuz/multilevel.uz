// One section's paper, for anyone: the questions without their answers. A premium test's paper
// is for Premium only (its page stays public).
export default defineEventHandler(async (event) => {
  const skill = String(getRouterParam(event, 'skill')).toUpperCase()
  if (!isSkill(skill)) throw createError({ statusCode: 404, message: 'Section not found' })
  const test = await loadTest({ slug: getRouterParam(event, 'slug')! }, { publishedOnly: true })
  const section = test.sections.find((s: any) => s.skill === skill)
  if (!section?.items?.length) throw createError({ statusCode: 404, message: 'Section not found' })
  if (test.access === 'PREMIUM' && !(await accessOf(await optionalUser(event))).premium) {
    paymentRequired('PREMIUM_REQUIRED', 'This test is part of Premium')
  }
  return {
    test: { id: test.id, slug: test.slug, title: test.title, mode: test.mode, access: test.access, skills: test.sections.filter((s: any) => s.items?.length).map((s: any) => s.skill) },
    section: paperSection(section)
  }
})
