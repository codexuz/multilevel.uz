/** The interface language: switching it also saves it on the account, so the bot writes in it too. */
export function useLanguage() {
  const { locale, locales, setLocale } = useI18n()
  const { loggedIn } = useMe()
  const languages = computed(() => (locales.value as { code: 'en' | 'uz' | 'ru', name: string }[]).map(l => ({ code: l.code, name: l.name })))
  async function choose(code: 'en' | 'uz' | 'ru') {
    await setLocale(code)
    if (loggedIn.value) await $fetch('/api/me/locale', { method: 'PATCH', body: { locale: code } }).catch(() => {})
  }
  return { locale, languages, choose }
}
