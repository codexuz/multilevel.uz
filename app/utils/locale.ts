/**
 * The interface language, for plain helpers (dates, skill names) that run while a page renders.
 * Components use `$t` / `useI18n()`; these read the same i18n instance through the app.
 */
const INTL: Record<string, string> = { en: 'en-GB', uz: 'uz-Latn-UZ', ru: 'ru-RU' }

const i18nOf = () => (tryUseNuxtApp()?.$i18n as { locale: { value: string }, t: (key: string, params?: Record<string, unknown>) => string } | undefined)

/** The current language: en, uz or ru. */
export const appLocale = () => i18nOf()?.locale.value ?? 'en'
/** The language as Intl wants it, for dates and numbers. */
export const intlLocale = () => INTL[appLocale()] ?? 'en-GB'
/** A message by key, or the fallback outside a running app (and while messages load). */
export function i18nT(key: string, params?: Record<string, unknown>, fallback = key) {
  const i18n = i18nOf()
  if (!i18n) return fallback
  const text = i18n.t(key, params ?? {})
  return text === key ? fallback : text
}
/** A message with a count (plural forms): "{n} day | {n} days". */
export function i18nTn(key: string, n: number, fallback: string) {
  const i18n = i18nOf() as unknown as { t: (key: string, named: Record<string, unknown>, plural: number) => string } | undefined
  if (!i18n) return fallback
  const text = i18n.t(key, { n }, n)
  return text === key ? fallback : text
}
