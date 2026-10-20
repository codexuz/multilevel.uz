// The ways to sign in that are set up here; the Telegram bot id is public (the start of its token).
export default defineEventHandler(() => {
  const google = useRuntimeConfig().oauth?.google as { clientId?: string } | undefined
  const botId = telegramBotId()
  return {
    google: !!(process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID || google?.clientId),
    telegram: botId ? { botId } : null
  }
})
