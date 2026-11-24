// How test packs are bought: through Click, or privately on Telegram when Click is not set up.
export default defineEventHandler(() => ({
  click: !!clickConfig(),
  telegram: useRuntimeConfig().public.salesTelegram as string
}))
