import { broadcasts } from '../../../database/schema'

// Sends a broadcast: { texts: { uz?, ru?, en? }, imageUrl?, buttonText?, buttonUrl?, audience, channelIds? }.
// Saved at once and sent in the background; the list shows its progress.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  if (!telegramBotToken()) throw createError({ statusCode: 503, message: 'The Telegram bot is not set up on this site' })
  const body = (await readBody(event)) ?? {}
  const d = draftOf(body)
  const audience = broadcastAudience(body.audience)
  const channelIds = Array.isArray(body.channelIds) && body.channelIds.length ? await pickChannels(body.channelIds) : null
  const total = await countAudience(audience)
  const [row] = await useDb().insert(broadcasts).values({ ...d, audience, channelIds, total, createdById: admin.id }).returning()
  runBroadcast(row!.id).catch(e => console.error('[broadcast]', e?.message ?? e))
  return row
})
