// The whole test as one printable paper, for Premium: every section's parts, passages, questions,
// tasks and Speaking cards, and the answer key of Listening and Reading (for the page at
// /tests/<slug>/pdf, which is saved as a PDF).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!(await accessOf(user)).premium) paymentRequired('PREMIUM_REQUIRED', 'Downloading tests as PDF is part of Premium')
  const test = await loadTest({ slug: getRouterParam(event, 'slug')! }, { publishedOnly: true })
  const sections = test.sections.filter((s: any) => s.items?.length).map((s: any) => paperSection(s, true))
  const key = sections.filter((s: any) => s.skill === 'LISTENING' || s.skill === 'READING').map((s: any) => ({
    skill: s.skill,
    answers: s.parts.flatMap((p: any) => (p.groups ?? []).flatMap((g: any) => (g.items ?? []).map((i: any) => ({ number: i.number, answers: i.acceptedAnswers ?? [] }))))
      .sort((a: any, b: any) => a.number - b.number)
  }))
  // The sitting's secrets stay out of the paper: no transcripts.
  for (const s of sections) for (const p of s.parts) delete p.transcriptUrl
  return { test: { slug: test.slug, title: test.title, description: test.description }, sections, key }
})
