interface TelegramLoginApi { auth: (options: { bot_id: string, request_access?: string, lang?: string }, callback: (user: Record<string, unknown> | false) => void) => void }
declare global {
  interface Window { Telegram?: { Login?: TelegramLoginApi } }
}

const WIDGET = 'https://telegram.org/js/telegram-widget.js?22'
let loading: Promise<TelegramLoginApi> | null = null

function loadWidget(): Promise<TelegramLoginApi> {
  if (window.Telegram?.Login) return Promise.resolve(window.Telegram.Login)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = WIDGET
    s.async = true
    s.onload = () => (window.Telegram?.Login ? resolve(window.Telegram.Login) : reject(new Error('Telegram did not load')))
    s.onerror = () => {
      loading = null
      reject(new Error('Telegram did not load'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Signing in with Telegram, or linking it to the signed-in account: Telegram's own popup asks the
 * user to confirm, and the server checks Telegram's signature. Only offered when the server has a
 * bot set up. The widget loads ahead of time so the popup opens straight from the click.
 */
export function useTelegramLogin() {
  const { data: providers } = useFetch<{ google: boolean, telegram: { botId: string } | null }>('/api/auth/providers', { key: 'auth-providers' })
  const available = computed(() => !!providers.value?.telegram)
  const busy = ref(false)
  const error = ref('')

  onMounted(() => {
    watch(available, a => a && loadWidget().catch(() => {}), { immediate: true })
  })

  /** Opens Telegram; resolves with where to go next, or null if it was closed or failed (see `error`). */
  async function start(): Promise<{ linked: boolean, to: string } | null> {
    const botId = providers.value?.telegram?.botId
    if (!botId) return null
    busy.value = true
    error.value = ''
    try {
      const login = window.Telegram?.Login ?? await loadWidget()
      const user = await new Promise<Record<string, unknown> | false>(resolve => login.auth({ bot_id: botId, lang: 'en' }, resolve))
      if (!user) return null
      return await $fetch<{ linked: boolean, to: string }>('/api/auth/telegram', { method: 'POST', body: user })
    } catch (e) {
      error.value = (e as { data?: { message?: string } }).data?.message || 'Telegram sign-in failed. Please try again.'
      return null
    } finally {
      busy.value = false
    }
  }

  return { providers, available, busy, error, start }
}
