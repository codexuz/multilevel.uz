// A published test's public page: what it is and what is in each section (no questions, no keys).
export default defineEventHandler(async (event) => {
  const test = await loadTest({ slug: getRouterParam(event, 'slug')! }, { publishedOnly: true })
  const summary = testSummary(test)
  const user = await optionalUser(event)
  return {
    /** The packs it is sold in. */
    packs: await packsOfTest(test.id, user?.id),
    id: test.id,
    slug: test.slug,
    title: test.title,
    description: test.description,
    mode: test.mode,
    access: test.access,
    category: test.category,
    module: test.module,
    exam: examOfTest(test),
    source: test.source,
    publishedAt: test.publishedAt,
    updatedAt: test.updatedAt,
    sections: summary.sections.map((s: any, i: number) => ({
      ...s,
      parts: (test.sections[i].items ?? []).map((item: any) => item.part
        ? { kind: 'part', partNumber: item.part.partNumber, title: item.part.title, questions: (item.part.groups ?? []).reduce((n: number, g: any) => n + (g.items?.length ?? 0), 0) }
        : item.writingTask
          ? { kind: 'task', taskNumber: item.writingTask.taskNumber, title: item.writingTask.title, minWords: minimumWordsFor(item.writingTask) }
          : { kind: 'speaking', partNumber: item.speakingPart?.partNumber, title: item.speakingPart?.title })
    }))
  }
})
