/**
 * Points the Telegram bot's updates at /api/telegram/webhook when the server starts, so pressing
 * Start in the bot is seen here. Only for a public https site; TELEGRAM_WEBHOOK=false leaves the
 * bot's webhook alone (if the bot is also used by something else).
 */
export default defineNitroPlugin(() => {
  if (import.meta.dev || import.meta.prerender || !telegramBotToken() || process.env.TELEGRAM_WEBHOOK === 'false') return
  const site = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '')
  if (!site.startsWith('https://')) return
  telegramApi('setWebhook', {
    url: `${site}/api/telegram/webhook`,
    secret_token: webhookSecret(),
    allowed_updates: ['message', 'my_chat_member']
  }).then((res) => {
    if (res.ok) console.info('[telegram] webhook set')
    else console.warn('[telegram] webhook not set:', res.description)
  }).catch(e => console.warn('[telegram] webhook not set:', e?.data?.description || e?.message))
})
