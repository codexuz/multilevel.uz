import { eq } from 'drizzle-orm'
import { liveMocks } from '../../../../database/schema'

// Posts a live mock to its Telegram channels now (or to the ones given), as it stands: coming, open, or its results.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const [m] = await useDb().select().from(liveMocks).where(eq(liveMocks.id, String(getRouterParam(event, 'id')))).limit(1)
  if (!m) throw createError({ statusCode: 404, message: 'Live mock not found' })
  const body = (await readBody<{ channelIds?: string[] }>(event).catch(() => null)) ?? {}
  const res = await postMockToChannel(m, new Date(), body.channelIds?.length ? body.channelIds.map(String) : undefined)
  if (!res.ok && !res.posts.some(p => p.ok)) throw createError({ statusCode: 409, message: res.error })
  return res
})
