import { eq } from 'drizzle-orm'
import { liveMocks } from '../../../../database/schema'

// Posts a live mock to the Telegram channel now, as it stands: coming, open, or its results.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const [m] = await useDb().select().from(liveMocks).where(eq(liveMocks.id, String(getRouterParam(event, 'id')))).limit(1)
  if (!m) throw createError({ statusCode: 404, message: 'Live mock not found' })
  const res = await postMockToChannel(m)
  if (!res.ok) throw createError({ statusCode: 409, message: res.error })
  return res
})
