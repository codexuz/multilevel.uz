// Opening a premium test with credits: it stays open for this user for good.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const test = await loadTest({ slug: getRouterParam(event, 'slug')! }, { publishedOnly: true })
  if (test.access !== 'PREMIUM' || (await accessOf(user)).premium) return { unlocked: true, credits: await rewardBalance(user.id) }
  const credits = await unlockTest(user.id, test.id)
  return { unlocked: true, credits }
})
