/**
 * Points the Telegram bot's updates at /api/telegram/webhook when the server starts, so pressing
 * Start in the bot is seen here. Uses the https site address; /api/telegram/link corrects it to
 * the address users are actually on if that differs. TELEGRAM_WEBHOOK=false leaves the bot's
 * webhook alone (if the bot is also used by something else).
 */
export default defineNitroPlugin(() => {
  if (import.meta.dev || import.meta.prerender) return
  const site = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '')
  ensureWebhook(site).catch(e => console.warn('[telegram] webhook not set:', e?.message))
})
