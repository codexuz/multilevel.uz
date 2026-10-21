// For admins: where the bot's updates go and Telegram's last delivery error, to see why joining
// the bot might not be noticed. ?fix=1 points the webhook at the address this was opened on.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  if (!telegramBotToken()) return { configured: false }
  const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
  if (getQuery(event).fix) await setWebhook(origin)
  const info = await webhookInfo()
  return {
    configured: true,
    bot: await botUsername(),
    expectedUrl: `${origin}/api/telegram/webhook`,
    webhookUrl: info?.url || null,
    pointsHere: info?.url === `${origin}/api/telegram/webhook`,
    pendingUpdates: info?.pending_update_count ?? null,
    lastError: info?.last_error_message ? { message: info.last_error_message, at: new Date((info.last_error_date ?? 0) * 1000) } : null
  }
})
