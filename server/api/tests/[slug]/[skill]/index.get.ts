// One section's paper, for a signed-in candidate: the questions without their answers; with
// ?part=N, that part alone, to practise on its own. A premium test's paper is for Premium, or for
// whoever opened that test with credits or bought it (or that part) in a pack. A test's page is public; sitting it needs sign-in.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const skill = String(getRouterParam(event, 'skill')).toUpperCase()
  if (!isSkill(skill)) throw createError({ statusCode: 404, message: 'Section not found' })
  const test = await loadTest({ slug: getRouterParam(event, 'slug')! }, { publishedOnly: true })
  const whole = test.sections.find((s: any) => s.skill === skill)
  if (!whole?.items?.length) throw createError({ statusCode: 404, message: 'Section not found' })
  const partNumber = getQuery(event).part ? Number(getQuery(event).part) : null
  const section = partNumber ? pickPart(whole, partNumber) : whole
  if (!section) throw createError({ statusCode: 404, message: 'Part not found' })
  // At a mock session's seat: only the sections the invigilator opened, and the board sees it begin.
  const seat = await seatGate(user.id, test.id, skill, partNumber)
  if (seat) await ping(user.id, { skill })
  else if (test.access === 'PREMIUM') {
    if (!(await canOpenTest(user, test, (await accessOf(user)).premium, partNumber ? section.items[0]?.id : null))) paymentRequired('PREMIUM_REQUIRED', 'This test is part of Premium')
  }
  return {
    test: { id: test.id, slug: test.slug, title: test.title, mode: test.mode, access: test.access, skills: test.sections.filter((s: any) => s.items?.length).map((s: any) => s.skill) },
    part: partNumber,
    seat: !!seat,
    section: partNumber ? paperPart(section) : paperSection(section)
  }
})
