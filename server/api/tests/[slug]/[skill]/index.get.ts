// One section's paper, for anyone: the questions without their answers.
export default defineEventHandler(async (event) => {
  const skill = String(getRouterParam(event, 'skill')).toUpperCase()
  if (!isSkill(skill)) throw createError({ statusCode: 404, message: 'Section not found' })
  const test = await loadTest({ slug: getRouterParam(event, 'slug')! }, { publishedOnly: true })
  const section = test.sections.find((s: any) => s.skill === skill)
  if (!section?.items?.length) throw createError({ statusCode: 404, message: 'Section not found' })
  return {
    test: { id: test.id, slug: test.slug, title: test.title, mode: test.mode, skills: test.sections.filter((s: any) => s.items?.length).map((s: any) => s.skill) },
    section: paperSection(section)
  }
})
