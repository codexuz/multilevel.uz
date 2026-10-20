// What is on sale, and how it is bought: through Click, or privately on Telegram when Click is not set up.
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  return {
    plans: (await activePlans()).map(planView),
    click: !!clickConfig(),
    telegram: config.public.salesTelegram as string
  }
})
