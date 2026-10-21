// Telegram's updates for the bot (registered by server/plugins/telegram-webhook.ts). Only calls
// that carry the webhook secret are read; the answer is always quick and empty.
export default defineEventHandler(async (event) => {
  if (!telegramBotToken() || getRequestHeader(event, 'x-telegram-bot-api-secret-token') !== webhookSecret()) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  const update = await readBody(event)
  await handleBotUpdate(update ?? {}).catch(e => console.error('[telegram] update failed:', e))
  return { ok: true }
})
